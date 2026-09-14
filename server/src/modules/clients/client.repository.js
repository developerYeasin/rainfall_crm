import { query, queryOne } from '../../db/pool.js';
import { buildWhere, buildPagination, buildOrder } from '../../utils/sql.js';

const SORTABLE = ['c.id', 'c.name', 'c.status', 'c.created_at', 'c.onboarded_at', 'c.monthly_retainer'];

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
    const { sql: where, params } = buildWhere([
      ['(c.name LIKE ? OR c.company LIKE ? OR c.contact_person LIKE ?)', search],
      ['c.status = ?', filters.status],
      ['c.account_manager_id = ?', filters.account_manager_id],
    ]);
    // The search clause holds three placeholders for a single value.
    const finalParams = search ? [search, search, search, ...params.slice(1)] : params;
    const order = buildOrder(filters.sortBy, filters.sortDir, SORTABLE, 'c.created_at');

    const rows = await query(`${BASE_SELECT} ${where} ${order} LIMIT ${limit} OFFSET ${offset}`, finalParams);
    const { total } = await queryOne(`SELECT COUNT(*) AS total FROM clients c ${where}`, finalParams);
    return { rows, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
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
