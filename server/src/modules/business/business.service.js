import { query, queryOne } from '../../db/pool.js';
import { ApiError } from '../../utils/ApiError.js';
import { buildWhere, buildPagination } from '../../utils/sql.js';
import { round, safeDiv } from '../../utils/metrics.js';
import { toDateOnly } from '../../utils/date.js';
import { SOLD_STATUS } from '../../config/constants.js';

const SOLD_SQL = SOLD_STATUS.map((s) => `'${s}'`).join(', ');
const num = (value) => Number(value || 0);

/** Empty strings from form inputs are stored as NULL; booleans as 0/1. */
const normalise = (payload) =>
  Object.fromEntries(
    Object.entries(payload).map(([k, v]) => [k, v === '' ? null : typeof v === 'boolean' ? Number(v) : v]),
  );

const insertRow = async (table, data) => {
  const cols = Object.keys(data);
  const res = await query(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    Object.values(data),
  );
  return res.insertId;
};

const updateRow = async (table, id, data) => {
  const cols = Object.keys(data);
  if (!cols.length) return;
  await query(`UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...Object.values(data), id]);
};

const dateClauses = (column, { from, to } = {}) => [
  [`${column} >= ?`, from],
  [`${column} <= ?`, to],
];

// ---------------------------------------------------------------- products

/** Stock = opening + purchased − sold. Returned/cancelled orders never leave stock. */
const decorateProduct = (p) => {
  const inStock = num(p.opening_stock) + num(p.purchased_qty) - num(p.sold_qty);
  return {
    ...p,
    is_active: !!p.is_active,
    purchased_qty: num(p.purchased_qty),
    sold_qty: num(p.sold_qty),
    pre_order_qty: num(p.pre_order_qty),
    returned_qty: num(p.returned_qty),
    in_stock: inStock,
    available: inStock - num(p.pre_order_qty),
    stock_value: round(inStock * num(p.cost_price)),
    stock_status: inStock <= 0 ? 'out' : inStock <= num(p.low_stock_alert) ? 'low' : 'ok',
  };
};

const productsWithStock = async (clientId, productId) => {
  const rows = await query(
    `SELECT p.*,
            pu.qty AS purchased_qty,
            s.sold_qty, s.pre_order_qty, s.returned_qty
     FROM products p
     LEFT JOIN (
       SELECT product_id, SUM(qty) AS qty FROM stock_purchases WHERE client_id = ? GROUP BY product_id
     ) pu ON pu.product_id = p.id
     LEFT JOIN (
       SELECT product_id,
              SUM(CASE WHEN status IN (${SOLD_SQL}) THEN qty ELSE 0 END) AS sold_qty,
              SUM(CASE WHEN status = 'pre_order' THEN qty ELSE 0 END) AS pre_order_qty,
              SUM(CASE WHEN status = 'returned' THEN qty ELSE 0 END) AS returned_qty
       FROM orders WHERE client_id = ? GROUP BY product_id
     ) s ON s.product_id = p.id
     WHERE p.client_id = ? ${productId ? 'AND p.id = ?' : ''}
     ORDER BY p.is_active DESC, p.name ASC`,
    productId ? [clientId, clientId, clientId, productId] : [clientId, clientId, clientId],
  );
  return rows.map(decorateProduct);
};

// ---------------------------------------------------------------- orders

const decorateOrder = (o) => {
  const amount = round(num(o.qty) * num(o.unit_price) - num(o.discount));
  return {
    ...o,
    order_date: toDateOnly(o.order_date),
    amount,
    due: round(Math.max(amount - num(o.paid_amount), 0)),
    profit: round(amount - num(o.qty) * num(o.unit_cost)),
  };
};

const ORDER_SELECT = `
  SELECT o.*, p.name AS product_name, p.sku AS product_sku
  FROM orders o
  JOIN products p ON p.id = o.product_id
`;

const orderWhere = (clientId, filters, { withStatus = true } = {}) => {
  const { sql, params } = buildWhere([
    ['o.client_id = ?', clientId],
    ['o.status = ?', withStatus ? filters.status : undefined],
    ['o.product_id = ?', filters.product_id],
    ...dateClauses('o.order_date', filters),
  ]);
  if (!filters.search) return { sql, params };
  // One search value feeds three placeholders.
  const like = `%${filters.search}%`;
  return {
    sql: `${sql} AND (o.customer_name LIKE ? OR o.customer_phone LIKE ? OR p.name LIKE ?)`,
    params: [...params, like, like, like],
  };
};

export const businessService = {
  async resolveClient(clientId) {
    const client = await queryOne('SELECT id, name, company, industry, status FROM clients WHERE id = ?', [clientId]);
    if (!client) throw ApiError.notFound('ক্লায়েন্ট পাওয়া যায়নি');
    return client;
  },

  // -------- products
  listProducts: (clientId) => productsWithStock(clientId),

  async getProduct(clientId, id) {
    const [product] = await productsWithStock(clientId, id);
    if (!product) throw ApiError.notFound('প্রোডাক্ট পাওয়া যায়নি');
    return product;
  },

  async createProduct(clientId, payload, userId) {
    const id = await insertRow('products', { ...normalise(payload), client_id: clientId, created_by: userId });
    return this.getProduct(clientId, id);
  },

  async updateProduct(clientId, id, payload) {
    await this.getProduct(clientId, id);
    await updateRow('products', id, normalise(payload));
    return this.getProduct(clientId, id);
  },

  async removeProduct(clientId, id) {
    await this.getProduct(clientId, id);
    const used = await queryOne('SELECT COUNT(*) AS total FROM orders WHERE product_id = ?', [id]);
    if (num(used.total) > 0) {
      throw ApiError.conflict('এই প্রোডাক্টে অর্ডার আছে — মুছে না ফেলে নিষ্ক্রিয় করুন');
    }
    await query('DELETE FROM products WHERE id = ?', [id]);
  },

  // -------- stock purchases
  async listPurchases(clientId, range) {
    const { sql, params } = buildWhere([['sp.client_id = ?', clientId], ...dateClauses('sp.purchase_date', range)]);
    const rows = await query(
      `SELECT sp.*, p.name AS product_name, (sp.qty * sp.unit_cost) AS total_cost
       FROM stock_purchases sp JOIN products p ON p.id = sp.product_id
       ${sql} ORDER BY sp.purchase_date DESC, sp.id DESC`,
      params,
    );
    return rows.map((r) => ({ ...r, purchase_date: toDateOnly(r.purchase_date), total_cost: round(num(r.total_cost)) }));
  },

  async createPurchase(clientId, payload, userId) {
    const product = await this.getProduct(clientId, payload.product_id);
    const id = await insertRow('stock_purchases', {
      ...normalise(payload),
      unit_cost: payload.unit_cost ?? product.cost_price,
      client_id: clientId,
      created_by: userId,
    });
    return queryOne('SELECT * FROM stock_purchases WHERE id = ?', [id]);
  },

  async removePurchase(clientId, id) {
    const row = await queryOne('SELECT id FROM stock_purchases WHERE id = ? AND client_id = ?', [id, clientId]);
    if (!row) throw ApiError.notFound('স্টক এন্ট্রি পাওয়া যায়নি');
    await query('DELETE FROM stock_purchases WHERE id = ?', [id]);
  },

  // -------- orders (sales + pre-orders)
  async listOrders(clientId, filters) {
    const { limit, offset, page } = buildPagination(filters);
    const { sql: where, params } = orderWhere(clientId, filters);
    const rows = await query(
      `${ORDER_SELECT} ${where} ORDER BY o.order_date DESC, o.id DESC LIMIT ${limit} OFFSET ${offset}`,
      params,
    );
    const { total } = await queryOne(
      `SELECT COUNT(*) AS total FROM orders o JOIN products p ON p.id = o.product_id ${where}`,
      params,
    );

    // Per-status counts ignore the status filter so the filter chips always show every bucket.
    const noStatus = orderWhere(clientId, filters, { withStatus: false });
    const statusRows = await query(
      `SELECT o.status, COUNT(*) AS orders, SUM(o.qty) AS qty
       FROM orders o JOIN products p ON p.id = o.product_id
       ${noStatus.sql} GROUP BY o.status`,
      noStatus.params,
    );

    return {
      rows: rows.map(decorateOrder),
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        status_counts: Object.fromEntries(statusRows.map((r) => [r.status, { orders: num(r.orders), qty: num(r.qty) }])),
      },
    };
  },

  async getOrder(clientId, id) {
    const row = await queryOne(`${ORDER_SELECT} WHERE o.id = ? AND o.client_id = ?`, [id, clientId]);
    if (!row) throw ApiError.notFound('অর্ডার পাওয়া যায়নি');
    return decorateOrder(row);
  },

  /** A sale cannot take more units than are physically in stock — take a pre-order instead. */
  ensureStock(product, qty, alreadyReserved = 0) {
    const available = product.in_stock + alreadyReserved;
    if (qty > available) {
      throw ApiError.badRequest(
        `"${product.name}" স্টকে আছে ${Math.max(available, 0)} পিস — বাকিটা প্রি-অর্ডার হিসেবে নিন`,
      );
    }
  },

  async createOrder(clientId, payload, userId) {
    const product = await this.getProduct(clientId, payload.product_id);
    if (SOLD_STATUS.includes(payload.status)) this.ensureStock(product, payload.qty);

    const id = await insertRow('orders', {
      ...normalise(payload),
      unit_price: payload.unit_price ?? product.sale_price,
      unit_cost: product.cost_price,
      client_id: clientId,
      created_by: userId,
    });
    return this.getOrder(clientId, id);
  },

  async updateOrder(clientId, id, payload) {
    const existing = await this.getOrder(clientId, id);
    const productChanged = payload.product_id && Number(payload.product_id) !== Number(existing.product_id);
    const product = await this.getProduct(clientId, payload.product_id ?? existing.product_id);

    const nextStatus = payload.status ?? existing.status;
    const nextQty = payload.qty ?? existing.qty;
    if (SOLD_STATUS.includes(nextStatus)) {
      const reserved = !productChanged && SOLD_STATUS.includes(existing.status) ? num(existing.qty) : 0;
      this.ensureStock(product, nextQty, reserved);
    }

    const patch = normalise(payload);
    if (productChanged) {
      patch.unit_cost = product.cost_price;
      if (payload.unit_price === undefined) patch.unit_price = product.sale_price;
    }
    await updateRow('orders', id, patch);
    return this.getOrder(clientId, id);
  },

  async removeOrder(clientId, id) {
    await this.getOrder(clientId, id);
    await query('DELETE FROM orders WHERE id = ?', [id]);
  },

  // -------- expenses
  async listExpenses(clientId, filters) {
    const { limit, offset, page } = buildPagination(filters);
    const { sql, params } = buildWhere([
      ['client_id = ?', clientId],
      ['category = ?', filters.category],
      ...dateClauses('expense_date', filters),
    ]);
    const rows = await query(
      `SELECT * FROM expenses ${sql} ORDER BY expense_date DESC, id DESC LIMIT ${limit} OFFSET ${offset}`,
      params,
    );
    const totals = await queryOne(`SELECT COUNT(*) AS total, COALESCE(SUM(amount), 0) AS amount FROM expenses ${sql}`, params);
    return {
      rows: rows.map((r) => ({ ...r, expense_date: toDateOnly(r.expense_date) })),
      meta: { total: num(totals.total), amount: round(num(totals.amount)), page, limit, pages: Math.ceil(totals.total / limit) },
    };
  },

  async getExpense(clientId, id) {
    const row = await queryOne('SELECT * FROM expenses WHERE id = ? AND client_id = ?', [id, clientId]);
    if (!row) throw ApiError.notFound('খরচ পাওয়া যায়নি');
    return { ...row, expense_date: toDateOnly(row.expense_date) };
  },

  async createExpense(clientId, payload, userId) {
    const id = await insertRow('expenses', { ...normalise(payload), client_id: clientId, created_by: userId });
    return this.getExpense(clientId, id);
  },

  async updateExpense(clientId, id, payload) {
    await this.getExpense(clientId, id);
    await updateRow('expenses', id, normalise(payload));
    return this.getExpense(clientId, id);
  },

  async removeExpense(clientId, id) {
    await this.getExpense(clientId, id);
    await query('DELETE FROM expenses WHERE id = ?', [id]);
  },

  // -------- summary
  /**
   * The client's A-to-Z view for a date range: sales, pre-orders, stock (always current),
   * marketing (ad spend from the performance tracker + manual marketing costs),
   * profit & loss and cash flow.
   */
  async summary(clientId, range) {
    const orderRange = buildWhere([['client_id = ?', clientId], ...dateClauses('order_date', range)]);
    const expenseRange = buildWhere([['client_id = ?', clientId], ...dateClauses('expense_date', range)]);
    const purchaseRange = buildWhere([['client_id = ?', clientId], ...dateClauses('purchase_date', range)]);
    const adRange = buildWhere([['cy.client_id = ?', clientId], ...dateClauses('pe.entry_date', range)]);
    const soldRange = buildWhere([
      ['o.client_id = ?', clientId],
      ...dateClauses('o.order_date', range),
    ]);

    const [client, orderRows, expenseRows, adTotals, purchaseTotals, products, monthlyOrders, monthlyExpenses, monthlyAds, topProducts] =
      await Promise.all([
        this.resolveClient(clientId),
        query(
          `SELECT status, COUNT(*) AS orders, SUM(qty) AS qty,
                  SUM(qty * unit_price - discount) AS amount, SUM(qty * unit_cost) AS cost, SUM(paid_amount) AS paid
           FROM orders ${orderRange.sql} GROUP BY status`,
          orderRange.params,
        ),
        query(`SELECT category, SUM(amount) AS total FROM expenses ${expenseRange.sql} GROUP BY category`, expenseRange.params),
        queryOne(
          `SELECT COALESCE(SUM(pe.spend), 0) AS spend, COALESCE(SUM(pe.revenue), 0) AS revenue,
                  COALESCE(SUM(pe.conversions), 0) AS conversions
           FROM performance_entries pe JOIN cycles cy ON cy.id = pe.cycle_id ${adRange.sql}`,
          adRange.params,
        ),
        queryOne(
          `SELECT COALESCE(SUM(qty), 0) AS qty, COALESCE(SUM(qty * unit_cost), 0) AS cost
           FROM stock_purchases ${purchaseRange.sql}`,
          purchaseRange.params,
        ),
        productsWithStock(clientId),
        query(
          `SELECT DATE_FORMAT(order_date, '%Y-%m') AS month,
                  SUM(CASE WHEN status IN (${SOLD_SQL}) THEN qty * unit_price - discount ELSE 0 END) AS revenue,
                  SUM(CASE WHEN status IN (${SOLD_SQL}) THEN qty * unit_cost ELSE 0 END) AS cogs,
                  SUM(CASE WHEN status IN (${SOLD_SQL}) THEN 1 ELSE 0 END) AS orders,
                  SUM(CASE WHEN status IN (${SOLD_SQL}) THEN qty ELSE 0 END) AS qty
           FROM orders ${orderRange.sql} GROUP BY month`,
          orderRange.params,
        ),
        query(
          `SELECT DATE_FORMAT(expense_date, '%Y-%m') AS month, SUM(amount) AS total
           FROM expenses ${expenseRange.sql} GROUP BY month`,
          expenseRange.params,
        ),
        query(
          `SELECT DATE_FORMAT(pe.entry_date, '%Y-%m') AS month, SUM(pe.spend) AS spend
           FROM performance_entries pe JOIN cycles cy ON cy.id = pe.cycle_id ${adRange.sql} GROUP BY month`,
          adRange.params,
        ),
        query(
          `SELECT p.id, p.name, SUM(o.qty) AS qty,
                  SUM(o.qty * o.unit_price - o.discount) AS revenue, SUM(o.qty * o.unit_cost) AS cost
           FROM orders o JOIN products p ON p.id = o.product_id
           ${soldRange.sql} AND o.status IN (${SOLD_SQL})
           GROUP BY p.id, p.name ORDER BY qty DESC LIMIT 5`,
          soldRange.params,
        ),
      ]);

    const byStatus = Object.fromEntries(orderRows.map((r) => [r.status, r]));
    const bucket = (...statuses) =>
      statuses.reduce(
        (acc, s) => {
          const r = byStatus[s];
          if (!r) return acc;
          acc.orders += num(r.orders);
          acc.qty += num(r.qty);
          acc.amount += num(r.amount);
          acc.cost += num(r.cost);
          acc.paid += num(r.paid);
          return acc;
        },
        { orders: 0, qty: 0, amount: 0, cost: 0, paid: 0 },
      );

    const sold = bucket(...SOLD_STATUS);
    const delivered = bucket('delivered');
    const preOrders = bucket('pre_order');
    const returned = bucket('returned');
    const cancelled = bucket('cancelled');

    const expenseByCategory = Object.fromEntries(expenseRows.map((r) => [r.category, round(num(r.total))]));
    const expensesTotal = round(Object.values(expenseByCategory).reduce((a, b) => a + b, 0));
    const otherMarketing = expenseByCategory.marketing || 0;
    const adSpend = round(num(adTotals.spend));
    const marketingTotal = round(adSpend + otherMarketing);

    const revenue = round(sold.amount);
    const cogs = round(sold.cost);
    const grossProfit = round(revenue - cogs);
    const totalCost = round(expensesTotal + adSpend);
    const netProfit = round(grossProfit - totalCost);

    const cashIn = round(sold.paid + preOrders.paid);
    const purchaseCost = round(num(purchaseTotals.cost));
    const cashOut = round(purchaseCost + expensesTotal + adSpend);

    const active = products.filter((p) => p.is_active);
    const months = new Map();
    const month = (key) => {
      if (!months.has(key)) months.set(key, { month: key, revenue: 0, cogs: 0, orders: 0, qty: 0, expenses: 0, ad_spend: 0 });
      return months.get(key);
    };
    for (const r of monthlyOrders) Object.assign(month(r.month), { revenue: num(r.revenue), cogs: num(r.cogs), orders: num(r.orders), qty: num(r.qty) });
    for (const r of monthlyExpenses) month(r.month).expenses = num(r.total);
    for (const r of monthlyAds) month(r.month).ad_spend = num(r.spend);

    return {
      client,
      range: { from: range.from ?? null, to: range.to ?? null },
      sales: {
        orders: sold.orders,
        qty: sold.qty,
        revenue,
        cogs,
        gross_profit: grossProfit,
        cash_received: round(sold.paid),
        due: round(Math.max(sold.amount - sold.paid, 0)),
        delivered_orders: delivered.orders,
        pending_delivery_orders: sold.orders - delivered.orders,
        avg_order_value: round(safeDiv(revenue, sold.orders)),
      },
      pre_orders: { orders: preOrders.orders, qty: preOrders.qty, value: round(preOrders.amount), advance: round(preOrders.paid) },
      returns: { orders: returned.orders, qty: returned.qty, value: round(returned.amount) },
      cancelled: { orders: cancelled.orders, qty: cancelled.qty },
      stock: {
        products: products.length,
        active_products: active.length,
        units: active.reduce((sum, p) => sum + Math.max(p.in_stock, 0), 0),
        value: round(active.reduce((sum, p) => sum + Math.max(p.stock_value, 0), 0)),
        retail_value: round(active.reduce((sum, p) => sum + Math.max(p.in_stock, 0) * num(p.sale_price), 0)),
        pending_pre_order_units: products.reduce((sum, p) => sum + p.pre_order_qty, 0),
        low: active.filter((p) => p.stock_status === 'low').length,
        out: active.filter((p) => p.stock_status === 'out').length,
        alerts: active
          .filter((p) => p.stock_status !== 'ok' || p.available < 0)
          .slice(0, 10)
          .map(({ id, name, in_stock, pre_order_qty, available, stock_status }) => ({ id, name, in_stock, pre_order_qty, available, stock_status })),
      },
      purchases: { qty: num(purchaseTotals.qty), cost: purchaseCost },
      marketing: {
        ad_spend: adSpend,
        other_marketing: otherMarketing,
        total: marketingTotal,
        ad_attributed_revenue: round(num(adTotals.revenue)),
        roas: round(safeDiv(revenue, marketingTotal), 2),
        cost_per_order: round(safeDiv(marketingTotal, sold.orders)),
      },
      expenses: {
        total: expensesTotal,
        by_category: Object.entries(expenseByCategory).map(([category, total]) => ({ category, total })),
      },
      profit: {
        gross: grossProfit,
        total_cost: totalCost,
        net: netProfit,
        margin: round(safeDiv(netProfit, revenue), 4),
      },
      cash: { in: cashIn, out: cashOut, balance: round(cashIn - cashOut) },
      monthly: [...months.values()]
        .sort((a, b) => a.month.localeCompare(b.month))
        .map((m) => ({ ...m, net_profit: round(m.revenue - m.cogs - m.expenses - m.ad_spend) })),
      top_products: topProducts.map((p) => ({
        id: p.id,
        name: p.name,
        qty: num(p.qty),
        revenue: round(num(p.revenue)),
        profit: round(num(p.revenue) - num(p.cost)),
      })),
    };
  },
};
