import { query, queryOne } from '../../db/pool.js';
import { ApiError } from '../../utils/ApiError.js';
import { buildWhere, buildPagination, buildOrder } from '../../utils/sql.js';
import { toDateOnly } from '../../utils/date.js';
import { cycleService } from '../cycles/cycle.service.js';

const BASE_SELECT = `
  SELECT c.*, u.name AS designer_user_name
  FROM content_calendar c
  LEFT JOIN users u ON u.id = c.designer_id
`;

const decorate = (row) => ({
  ...row,
  plan_date: toDateOnly(row.plan_date),
  publish_date: toDateOnly(row.publish_date),
});

const nullDefaults = (payload) => ({
  designer_id: null,
  designer_name: null,
  publish_date: null,
  note: null,
  ...payload,
});

export const contentService = {
  async list(filters) {
    const { limit, offset, page } = buildPagination(filters);
    const { sql: where, params } = buildWhere([
      ['c.cycle_id = ?', filters.cycle_id],
      ['c.status = ?', filters.status],
      ['c.platform = ?', filters.platform],
      ['c.plan_date >= ?', filters.from],
      ['c.plan_date <= ?', filters.to],
    ]);
    const order = buildOrder('c.plan_date', filters.sortDir, ['c.plan_date'], 'c.plan_date');
    const rows = await query(`${BASE_SELECT} ${where} ${order} LIMIT ${limit} OFFSET ${offset}`, params);
    const { total } = await queryOne(`SELECT COUNT(*) AS total FROM content_calendar c ${where}`, params);
    const statusCounts = await query(
      'SELECT status, COUNT(*) AS total FROM content_calendar WHERE cycle_id = ? GROUP BY status',
      [filters.cycle_id],
    );
    return { rows: rows.map(decorate), meta: { total, page, limit, pages: Math.ceil(total / limit), statusCounts } };
  },

  async getById(id) {
    const row = await queryOne(`${BASE_SELECT} WHERE c.id = ?`, [id]);
    if (!row) throw ApiError.notFound('কন্টেন্ট আইটেম পাওয়া যায়নি');
    return decorate(row);
  },

  async create(payload) {
    await cycleService.getById(payload.cycle_id);
    const data = nullDefaults(payload);
    const cols = Object.keys(data);
    const res = await query(
      `INSERT INTO content_calendar (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      Object.values(data),
    );
    return this.getById(res.insertId);
  },

  async update(id, payload) {
    await this.getById(id);
    const cols = Object.keys(payload);
    if (cols.length) {
      await query(`UPDATE content_calendar SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [
        ...Object.values(payload),
        id,
      ]);
    }
    return this.getById(id);
  },

  async remove(id) {
    await this.getById(id);
    await query('DELETE FROM content_calendar WHERE id = ?', [id]);
  },
};
