import { query, queryOne } from '../../db/pool.js';
import { buildWhere, buildPagination, buildOrder } from '../../utils/sql.js';

const SORTABLE = ['p.entry_date', 'p.spend', 'p.revenue', 'p.clicks', 'p.impressions', 'p.id'];

const BASE_SELECT = `
  SELECT p.*, u.name AS created_by_name
  FROM performance_entries p
  LEFT JOIN users u ON u.id = p.created_by
`;

export const performanceRepository = {
  async list(filters) {
    const { limit, offset, page } = buildPagination(filters);
    const { sql: where, params } = buildWhere([
      ['p.cycle_id = ?', filters.cycle_id],
      ['p.week_no = ?', filters.week_no],
      ['p.platform = ?', filters.platform],
      ['p.entry_date >= ?', filters.from],
      ['p.entry_date <= ?', filters.to],
    ]);
    const order = buildOrder(filters.sortBy, filters.sortDir, SORTABLE, 'p.entry_date');
    const rows = await query(`${BASE_SELECT} ${where} ${order} LIMIT ${limit} OFFSET ${offset}`, params);
    const { total } = await queryOne(`SELECT COUNT(*) AS total FROM performance_entries p ${where}`, params);
    return { rows, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
  },

  allForCycle(cycleId) {
    return query('SELECT * FROM performance_entries WHERE cycle_id = ? ORDER BY entry_date ASC, id ASC', [cycleId]);
  },

  findById(id) {
    return queryOne(`${BASE_SELECT} WHERE p.id = ?`, [id]);
  },

  async insert(data) {
    const cols = Object.keys(data);
    const res = await query(
      `INSERT INTO performance_entries (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      Object.values(data),
    );
    return res.insertId;
  },

  async update(id, data) {
    const cols = Object.keys(data);
    if (!cols.length) return;
    await query(`UPDATE performance_entries SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [
      ...Object.values(data),
      id,
    ]);
  },

  remove(id) {
    return query('DELETE FROM performance_entries WHERE id = ?', [id]);
  },

  /** Weekly revenue/spend rollup — the SUMIFS() behind the control sheet. */
  weeklyTotals(cycleId) {
    return query(
      `SELECT week_no,
              SUM(spend) AS spend,
              SUM(impressions) AS impressions,
              SUM(clicks) AS clicks,
              SUM(conversions) AS conversions,
              SUM(revenue) AS revenue
       FROM performance_entries
       WHERE cycle_id = ?
       GROUP BY week_no`,
      [cycleId],
    );
  },

  platformTotals(cycleId) {
    return query(
      `SELECT platform,
              SUM(spend) AS spend,
              SUM(clicks) AS clicks,
              SUM(impressions) AS impressions,
              SUM(conversions) AS conversions,
              SUM(revenue) AS revenue
       FROM performance_entries
       WHERE cycle_id = ?
       GROUP BY platform
       ORDER BY revenue DESC`,
      [cycleId],
    );
  },

  dailySeries(cycleId) {
    return query(
      `SELECT entry_date,
              SUM(spend) AS spend,
              SUM(revenue) AS revenue,
              SUM(clicks) AS clicks,
              SUM(conversions) AS conversions
       FROM performance_entries
       WHERE cycle_id = ?
       GROUP BY entry_date
       ORDER BY entry_date ASC`,
      [cycleId],
    );
  },

  reportedDays(cycleId) {
    return queryOne('SELECT COUNT(DISTINCT entry_date) AS days FROM performance_entries WHERE cycle_id = ?', [cycleId]);
  },
};
