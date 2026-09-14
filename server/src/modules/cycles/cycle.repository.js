import { query, queryOne } from '../../db/pool.js';
import { buildWhere, buildPagination, buildOrder } from '../../utils/sql.js';

const SORTABLE = ['cy.id', 'cy.month_start', 'cy.created_at', 'cy.monthly_budget'];

const BASE_SELECT = `
  SELECT cy.*, c.name AS client_name, c.company AS client_company
  FROM cycles cy
  JOIN clients c ON c.id = cy.client_id
`;

export const cycleRepository = {
  async list(filters) {
    const { limit, offset, page } = buildPagination(filters);
    const { sql: where, params } = buildWhere([
      ['cy.client_id = ?', filters.client_id],
      ['cy.status = ?', filters.status],
    ]);
    const order = buildOrder(filters.sortBy, filters.sortDir, SORTABLE, 'cy.month_start');
    const rows = await query(`${BASE_SELECT} ${where} ${order} LIMIT ${limit} OFFSET ${offset}`, params);
    const { total } = await queryOne(`SELECT COUNT(*) AS total FROM cycles cy ${where}`, params);
    return { rows, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
  },

  findById(id) {
    return queryOne(`${BASE_SELECT} WHERE cy.id = ?`, [id]);
  },

  async insert(data, conn = null) {
    const cols = Object.keys(data);
    const sql = `INSERT INTO cycles (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
    if (conn) {
      const [res] = await conn.execute(sql, Object.values(data));
      return res.insertId;
    }
    const res = await query(sql, Object.values(data));
    return res.insertId;
  },

  async update(id, data) {
    const cols = Object.keys(data);
    if (!cols.length) return;
    await query(`UPDATE cycles SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [
      ...Object.values(data),
      id,
    ]);
  },

  remove(id) {
    return query('DELETE FROM cycles WHERE id = ?', [id]);
  },

  weeks(cycleId) {
    return query('SELECT * FROM target_weeks WHERE cycle_id = ? ORDER BY week_no ASC', [cycleId]);
  },

  async replaceWeeks(cycleId, weeks, conn) {
    const exec = conn ? (sql, p) => conn.execute(sql, p) : (sql, p) => query(sql, p);
    await exec('DELETE FROM target_weeks WHERE cycle_id = ?', [cycleId]);
    for (const w of weeks) {
      await exec(
        'INSERT INTO target_weeks (cycle_id, week_no, label, start_date, end_date, budget) VALUES (?, ?, ?, ?, ?, ?)',
        [cycleId, w.week_no, w.label, w.start_date, w.end_date, w.budget],
      );
    }
  },

  updateWeek(cycleId, weekNo, data) {
    const cols = Object.keys(data);
    if (!cols.length) return null;
    return query(`UPDATE target_weeks SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE cycle_id = ? AND week_no = ?`, [
      ...Object.values(data),
      cycleId,
      weekNo,
    ]);
  },
};
