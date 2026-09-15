import { query, queryOne } from '../../db/pool.js';
import { buildWhere, buildPagination, buildOrder } from '../../utils/sql.js';
import { andWhere, scopeSql } from '../../utils/access.js';
import { SOLD_STATUS } from '../../config/constants.js';

const SORTABLE = ['c.id', 'c.name', 'c.status', 'c.created_at', 'c.onboarded_at', 'c.monthly_retainer'];
const SOLD_SQL = SOLD_STATUS.map((s) => `'${s}'`).join(', ');
const num = (v) => Number(v || 0);

const BASE_SELECT = `
  SELECT c.*, u.name AS account_manager_name,
         (SELECT COUNT(*) FROM cycles cy WHERE cy.client_id = c.id) AS cycles_count
  FROM clients c
  LEFT JOIN users u ON u.id = c.account_manager_id
`;

export const clientRepository = {
  async list(filters) {
    const { limit, offset, page } = buildPagination(filters);
    const search = filters.search ? `%${filters.search}%` : undefined;
    const built = buildWhere([
      ['(c.name LIKE ? OR c.company LIKE ? OR c.contact_person LIKE ?)', search],
      ['c.status = ?', filters.status],
      ['c.account_manager_id = ?', filters.account_manager_id],
    ]);
    const where = andWhere(built.sql, scopeSql('c.id', filters.scope ?? null));
    // The search clause holds three placeholders for a single value.
    const finalParams = search ? [search, search, search, ...built.params.slice(1)] : built.params;
    const order = buildOrder(filters.sortBy, filters.sortDir, SORTABLE, 'c.created_at');

    const rows = await query(`${BASE_SELECT} ${where} ${order} LIMIT ${limit} OFFSET ${offset}`, finalParams);
    const { total } = await queryOne(`SELECT COUNT(*) AS total FROM clients c ${where}`, finalParams);
    return { rows, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
  },

  /**
   * Quick-glance numbers for the client grid: this month's ad spend (synced + manual),
   * this month's sales, unpaid invoice balance and low/out-of-stock product count.
   */
  async stats(ids) {
    const out = new Map(ids.map((id) => [id, { month_ad_spend: 0, month_sales: 0, dues: 0, low_stock: 0 }]));
    if (!ids.length) return out;
    const list = ids.map(Number).join(', ');
    const monthStart = "DATE_FORMAT(CURDATE(), '%Y-%m-01')";

    const [synced, manual, sales, dues, stock] = await Promise.all([
      query(
        `SELECT client_id, SUM(spend) AS v FROM ad_insights
         WHERE level = 'account' AND stat_date >= ${monthStart} AND client_id IN (${list}) GROUP BY client_id`,
      ),
      query(
        `SELECT cy.client_id, SUM(pe.spend) AS v FROM performance_entries pe JOIN cycles cy ON cy.id = pe.cycle_id
         WHERE pe.entry_date >= ${monthStart} AND cy.client_id IN (${list}) GROUP BY cy.client_id`,
      ),
      query(
        `SELECT client_id, SUM(qty * unit_price - discount) AS v FROM orders
         WHERE status IN (${SOLD_SQL}) AND order_date >= ${monthStart} AND client_id IN (${list}) GROUP BY client_id`,
      ),
      query(
        `SELECT i.client_id, SUM(i.agency_fee + i.other_charges - COALESCE(p.paid, 0)) AS v
         FROM invoices i
         LEFT JOIN (SELECT invoice_id, SUM(amount) AS paid FROM invoice_payments GROUP BY invoice_id) p ON p.invoice_id = i.id
         WHERE i.status = 'issued' AND i.client_id IN (${list}) GROUP BY i.client_id`,
      ),
      query(
        `SELECT p.client_id, COUNT(*) AS v FROM products p
         LEFT JOIN (SELECT product_id, SUM(qty) AS q FROM stock_purchases GROUP BY product_id) pu ON pu.product_id = p.id
         LEFT JOIN (SELECT product_id, SUM(qty) AS q FROM orders WHERE status IN (${SOLD_SQL}) GROUP BY product_id) so ON so.product_id = p.id
         WHERE p.is_active = 1 AND p.client_id IN (${list})
           AND p.opening_stock + COALESCE(pu.q, 0) - COALESCE(so.q, 0) <= p.low_stock_alert
         GROUP BY p.client_id`,
      ),
    ]);

    const add = (rows, key) => rows.forEach((r) => (out.get(Number(r.client_id))[key] += num(r.v)));
    add(synced, 'month_ad_spend');
    add(manual, 'month_ad_spend');
    add(sales, 'month_sales');
    add(dues, 'dues');
    add(stock, 'low_stock');
    for (const s of out.values()) {
      s.month_ad_spend = Math.round(s.month_ad_spend * 100) / 100;
      s.month_sales = Math.round(s.month_sales * 100) / 100;
      s.dues = Math.max(Math.round(s.dues * 100) / 100, 0);
    }
    return out;
  },

  findById(id) {
    return queryOne(`${BASE_SELECT} WHERE c.id = ?`, [id]);
  },

  async insert(data) {
    const cols = Object.keys(data);
    const res = await query(
      `INSERT INTO clients (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      Object.values(data),
    );
    return res.insertId;
  },

  async update(id, data) {
    const cols = Object.keys(data);
    if (!cols.length) return;
    await query(`UPDATE clients SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [
      ...Object.values(data),
      id,
    ]);
  },

  remove(id) {
    return query('DELETE FROM clients WHERE id = ?', [id]);
  },

  statusCounts() {
    return query('SELECT status, COUNT(*) AS total FROM clients GROUP BY status');
  },
};
