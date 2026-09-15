import { query, queryOne } from '../../db/pool.js';
import { ApiError } from '../../utils/ApiError.js';
import { andWhere, scopeSql } from '../../utils/access.js';
import { buildWhere } from '../../utils/sql.js';
import { round } from '../../utils/metrics.js';
import { toDateOnly, monthStart } from '../../utils/date.js';
import { SOLD_STATUS } from '../../config/constants.js';

const SOLD_SQL = SOLD_STATUS.map((s) => `'${s}'`).join(', ');
const num = (v) => Number(v || 0);

const INVOICE_SELECT = `
  SELECT i.*, c.name AS client_name, COALESCE(p.paid, 0) AS paid, p.last_paid_on
  FROM invoices i
  JOIN clients c ON c.id = i.client_id
  LEFT JOIN (SELECT invoice_id, SUM(amount) AS paid, MAX(paid_on) AS last_paid_on FROM invoice_payments GROUP BY invoice_id) p
    ON p.invoice_id = i.id
`;

/** Invoice state is derived, never stored: cancelled → paid → overdue → partial → due. */
export const decorateInvoice = (row, today = toDateOnly(new Date())) => {
  const total = round(num(row.agency_fee) + num(row.other_charges));
  const paid = round(num(row.paid));
  const balance = round(Math.max(total - paid, 0));
  const due = toDateOnly(row.due_date);
  let state = 'due';
  if (row.status === 'cancelled') state = 'cancelled';
  else if (balance <= 0) state = 'paid';
  else if (due < today) state = 'overdue';
  else if (paid > 0) state = 'partial';
  return {
    ...row,
    period_month: toDateOnly(row.period_month),
    issue_date: toDateOnly(row.issue_date),
    due_date: due,
    last_paid_on: toDateOnly(row.last_paid_on),
    total,
    paid,
    balance: row.status === 'cancelled' ? 0 : balance,
    state,
  };
};

const monthsOfYear = (year) => Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
const byMonth = (rows, key = 'v') => new Map(rows.map((r) => [r.month, num(r[key])]));

export const financeService = {
  // ---------------------------------------------------------------- invoices
  async listInvoices(scope, filters = {}) {
    const built = buildWhere([
      ['i.client_id = ?', filters.client_id],
      ['i.period_month >= ?', filters.from],
      ['i.period_month <= ?', filters.to],
    ]);
    const where = andWhere(built.sql, scopeSql('i.client_id', scope));
    const rows = (await query(`${INVOICE_SELECT} ${where} ORDER BY i.issue_date DESC, i.id DESC`, built.params)).map((r) =>
      decorateInvoice(r),
    );
    const list = filters.state ? rows.filter((r) => r.state === filters.state) : rows;
    const live = rows.filter((r) => r.state !== 'cancelled');
    return {
      rows: list,
      meta: {
        invoiced: round(live.reduce((s, r) => s + r.total, 0)),
        collected: round(live.reduce((s, r) => s + r.paid, 0)),
        outstanding: round(live.reduce((s, r) => s + r.balance, 0)),
        overdue: round(live.filter((r) => r.state === 'overdue').reduce((s, r) => s + r.balance, 0)),
      },
    };
  },

  async getInvoice(id, scope = null) {
    const where = andWhere('WHERE i.id = ?', scopeSql('i.client_id', scope));
    const row = await queryOne(`${INVOICE_SELECT} ${where}`, [id]);
    if (!row) throw ApiError.notFound('ইনভয়েস পাওয়া যায়নি');
    const payments = await query('SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY paid_on DESC, id DESC', [id]);
    return { ...decorateInvoice(row), payments: payments.map((p) => ({ ...p, paid_on: toDateOnly(p.paid_on) })) };
  },

  async createInvoice(payload, userId) {
    const client = await queryOne('SELECT id, monthly_retainer FROM clients WHERE id = ?', [payload.client_id]);
    if (!client) throw ApiError.notFound('ক্লায়েন্ট পাওয়া যায়নি');
    const period = monthStart(payload.period_month);
    const res = await query(
      `INSERT INTO invoices (client_id, invoice_no, period_month, issue_date, due_date, agency_fee, other_charges, note, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.client_id,
        `TMP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        period,
        payload.issue_date,
        payload.due_date,
        payload.agency_fee ?? num(client.monthly_retainer),
        payload.other_charges ?? 0,
        payload.note || null,
        userId,
      ],
    );
    const invoiceNo = `RF-${period.slice(0, 7).replace('-', '')}-${String(res.insertId).padStart(4, '0')}`;
    await query('UPDATE invoices SET invoice_no = ? WHERE id = ?', [invoiceNo, res.insertId]);
    return this.getInvoice(res.insertId);
  },

  async updateInvoice(id, payload, scope) {
    await this.getInvoice(id, scope);
    const patch = { ...payload };
    if (patch.period_month) patch.period_month = monthStart(patch.period_month);
    const cols = Object.keys(patch);
    if (cols.length) {
      await query(`UPDATE invoices SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [
        ...cols.map((c) => (patch[c] === '' ? null : patch[c])),
        id,
      ]);
    }
    return this.getInvoice(id);
  },

  async addPayment(invoiceId, payload, userId, scope) {
    const invoice = await this.getInvoice(invoiceId, scope);
    if (invoice.state === 'cancelled') throw ApiError.badRequest('বাতিল ইনভয়েসে পেমেন্ট নেওয়া যায় না');
    if (payload.amount > invoice.balance + 0.005) {
      throw ApiError.badRequest(`বাকি আছে ৳${invoice.balance} — এর বেশি পেমেন্ট নেওয়া যায় না`);
    }
    await query(
      'INSERT INTO invoice_payments (invoice_id, client_id, amount, paid_on, method, reference, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [invoiceId, invoice.client_id, payload.amount, payload.paid_on, payload.method || null, payload.reference || null, userId],
    );
    return this.getInvoice(invoiceId);
  },

  async removePayment(paymentId, scope) {
    const payment = await queryOne('SELECT * FROM invoice_payments WHERE id = ?', [paymentId]);
    if (!payment) throw ApiError.notFound('পেমেন্ট পাওয়া যায়নি');
    await this.getInvoice(payment.invoice_id, scope);
    await query('DELETE FROM invoice_payments WHERE id = ?', [paymentId]);
    return payment;
  },

  // ---------------------------------------------------------------- agency expenses
  async listAgencyExpenses({ from, to } = {}) {
    const { sql, params } = buildWhere([
      ['expense_date >= ?', from],
      ['expense_date <= ?', to],
    ]);
    const rows = await query(
      `SELECT e.*, u.name AS created_by_name FROM agency_expenses e LEFT JOIN users u ON u.id = e.created_by
       ${sql.replace(/expense_date/g, 'e.expense_date')} ORDER BY e.expense_date DESC, e.id DESC`,
      params,
    );
    return rows.map((r) => ({ ...r, expense_date: toDateOnly(r.expense_date) }));
  },

  async createAgencyExpense(payload, userId) {
    const res = await query(
      'INSERT INTO agency_expenses (expense_date, category, amount, note, created_by) VALUES (?, ?, ?, ?, ?)',
      [payload.expense_date, payload.category, payload.amount, payload.note || null, userId],
    );
    return queryOne('SELECT * FROM agency_expenses WHERE id = ?', [res.insertId]);
  },

  async removeAgencyExpense(id) {
    const row = await queryOne('SELECT * FROM agency_expenses WHERE id = ?', [id]);
    if (!row) throw ApiError.notFound('খরচ পাওয়া যায়নি');
    await query('DELETE FROM agency_expenses WHERE id = ?', [id]);
    return row;
  },

  // ---------------------------------------------------------------- agency P&L
  /**
   * The agency's own books for a year, month by month:
   *   invoiced  = fees billed for that service month (accrual)
   *   collected = payments received that month (cash)
   *   profit    = collected − agency expenses
   */
  async agencyPnl(year) {
    const [invoiced, collected, expenses, byCategory, byClient, outstanding] = await Promise.all([
      query(
        `SELECT DATE_FORMAT(period_month, '%Y-%m') AS month, SUM(agency_fee + other_charges) AS v
         FROM invoices WHERE status = 'issued' AND YEAR(period_month) = ? GROUP BY month`,
        [year],
      ),
      query(
        `SELECT DATE_FORMAT(p.paid_on, '%Y-%m') AS month, SUM(p.amount) AS v
         FROM invoice_payments p JOIN invoices i ON i.id = p.invoice_id
         WHERE i.status = 'issued' AND YEAR(p.paid_on) = ? GROUP BY month`,
        [year],
      ),
      query(
        `SELECT DATE_FORMAT(expense_date, '%Y-%m') AS month, SUM(amount) AS v
         FROM agency_expenses WHERE YEAR(expense_date) = ? GROUP BY month`,
        [year],
      ),
      query('SELECT category, SUM(amount) AS v FROM agency_expenses WHERE YEAR(expense_date) = ? GROUP BY category ORDER BY v DESC', [
        year,
      ]),
      query(
        `SELECT c.id, c.name, SUM(i.agency_fee + i.other_charges) AS invoiced, COALESCE(SUM(p.paid), 0) AS collected
         FROM invoices i JOIN clients c ON c.id = i.client_id
         LEFT JOIN (SELECT invoice_id, SUM(amount) AS paid FROM invoice_payments GROUP BY invoice_id) p ON p.invoice_id = i.id
         WHERE i.status = 'issued' AND YEAR(i.period_month) = ?
         GROUP BY c.id, c.name ORDER BY invoiced DESC`,
        [year],
      ),
      queryOne(
        `SELECT COALESCE(SUM(i.agency_fee + i.other_charges - COALESCE(p.paid, 0)), 0) AS v
         FROM invoices i LEFT JOIN (SELECT invoice_id, SUM(amount) AS paid FROM invoice_payments GROUP BY invoice_id) p
           ON p.invoice_id = i.id
         WHERE i.status = 'issued'`,
      ),
    ]);

    const inv = byMonth(invoiced);
    const col = byMonth(collected);
    const exp = byMonth(expenses);
    const months = monthsOfYear(year).map((month) => {
      const row = { month, invoiced: round(inv.get(month) || 0), collected: round(col.get(month) || 0), expenses: round(exp.get(month) || 0) };
      return { ...row, profit: round(row.collected - row.expenses) };
    });
    const sum = (key) => round(months.reduce((s, m) => s + m[key], 0));

    return {
      year,
      months,
      totals: { invoiced: sum('invoiced'), collected: sum('collected'), expenses: sum('expenses'), profit: sum('profit') },
      outstanding: round(Math.max(num(outstanding.v), 0)),
      expenses_by_category: byCategory.map((r) => ({ category: r.category, total: round(num(r.v)) })),
      by_client: byClient.map((r) => ({
        id: r.id,
        name: r.name,
        invoiced: round(num(r.invoiced)),
        collected: round(num(r.collected)),
        outstanding: round(num(r.invoiced) - num(r.collected)),
      })),
    };
  },

  // ---------------------------------------------------------------- client monthly accounting
  /**
   * A client's own monthly P&L for a year. Ad spend comes from synced ad accounts when that month
   * has synced data, otherwise from the manual performance tracker — never both, to avoid double counting.
   */
  async clientAccounting(clientId, year) {
    const [sales, synced, manual, fees, expenses, expenseCats] = await Promise.all([
      query(
        `SELECT DATE_FORMAT(order_date, '%Y-%m') AS month, SUM(qty * unit_price - discount) AS revenue,
                SUM(qty * unit_cost) AS cogs, COUNT(*) AS orders
         FROM orders WHERE client_id = ? AND status IN (${SOLD_SQL}) AND YEAR(order_date) = ? GROUP BY month`,
        [clientId, year],
      ),
      query(
        `SELECT DATE_FORMAT(stat_date, '%Y-%m') AS month, SUM(spend) AS v
         FROM ad_insights WHERE client_id = ? AND level = 'account' AND YEAR(stat_date) = ? GROUP BY month`,
        [clientId, year],
      ),
      query(
        `SELECT DATE_FORMAT(pe.entry_date, '%Y-%m') AS month, SUM(pe.spend) AS v
         FROM performance_entries pe JOIN cycles cy ON cy.id = pe.cycle_id
         WHERE cy.client_id = ? AND YEAR(pe.entry_date) = ? GROUP BY month`,
        [clientId, year],
      ),
      query(
        `SELECT DATE_FORMAT(period_month, '%Y-%m') AS month, SUM(agency_fee + other_charges) AS v
         FROM invoices WHERE client_id = ? AND status = 'issued' AND YEAR(period_month) = ? GROUP BY month`,
        [clientId, year],
      ),
      query(
        `SELECT DATE_FORMAT(expense_date, '%Y-%m') AS month, SUM(amount) AS v
         FROM expenses WHERE client_id = ? AND YEAR(expense_date) = ? GROUP BY month`,
        [clientId, year],
      ),
      query(
        `SELECT DATE_FORMAT(expense_date, '%Y-%m') AS month, category, SUM(amount) AS v
         FROM expenses WHERE client_id = ? AND YEAR(expense_date) = ? GROUP BY month, category`,
        [clientId, year],
      ),
    ]);

    const salesBy = new Map(sales.map((r) => [r.month, r]));
    const syncedBy = byMonth(synced);
    const manualBy = byMonth(manual);
    const feesBy = byMonth(fees);
    const expBy = byMonth(expenses);

    const months = monthsOfYear(year).map((month) => {
      const s = salesBy.get(month);
      const revenue = round(num(s?.revenue));
      const cogs = round(num(s?.cogs));
      const adSpend = round(syncedBy.get(month) || manualBy.get(month) || 0);
      const agencyFee = round(feesBy.get(month) || 0);
      const other = round(expBy.get(month) || 0);
      return {
        month,
        revenue,
        orders: num(s?.orders),
        product_cost: cogs,
        gross_profit: round(revenue - cogs),
        ad_spend: adSpend,
        ad_spend_source: syncedBy.get(month) ? 'synced' : manualBy.get(month) ? 'manual' : null,
        agency_fee: agencyFee,
        other_expenses: other,
        expenses_by_category: expenseCats
          .filter((r) => r.month === month)
          .map((r) => ({ category: r.category, total: round(num(r.v)) })),
        total_expense: round(cogs + adSpend + agencyFee + other),
        net_profit: round(revenue - cogs - adSpend - agencyFee - other),
      };
    });

    const sum = (key) => round(months.reduce((acc, m) => acc + m[key], 0));
    const client = await queryOne('SELECT id, name, company FROM clients WHERE id = ?', [clientId]);
    return {
      client,
      year,
      months,
      totals: Object.fromEntries(
        ['revenue', 'orders', 'product_cost', 'gross_profit', 'ad_spend', 'agency_fee', 'other_expenses', 'total_expense', 'net_profit'].map(
          (k) => [k, sum(k)],
        ),
      ),
    };
  },
};
