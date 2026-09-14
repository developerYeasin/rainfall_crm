import { query, queryOne } from '../../db/pool.js';
import { ApiError } from '../../utils/ApiError.js';
import { buildWhere, buildPagination, buildOrder } from '../../utils/sql.js';
import { complianceScore, round, safeDiv } from '../../utils/metrics.js';
import { toDateOnly } from '../../utils/date.js';
import { cycleService } from '../cycles/cycle.service.js';

const BASE_SELECT = `
  SELECT t.*, u.name AS assignee_name
  FROM task_compliance t
  LEFT JOIN users u ON u.id = t.assignee_id
`;

const decorate = (row) => ({
  ...row,
  task_date: toDateOnly(row.task_date),
  morning_check: !!row.morning_check,
  ad_monitoring_done: !!row.ad_monitoring_done,
  report_updated: !!row.report_updated,
  client_update_sent: !!row.client_update_sent,
  compliance: complianceScore(row),
});

const toDbBooleans = (payload) => {
  const out = { ...payload };
  for (const key of ['morning_check', 'ad_monitoring_done', 'report_updated', 'client_update_sent']) {
    if (key in out) out[key] = out[key] ? 1 : 0;
  }
  return out;
};

export const taskService = {
  async list(filters) {
    const { limit, offset, page } = buildPagination(filters);
    const { sql: where, params } = buildWhere([
      ['t.cycle_id = ?', filters.cycle_id],
      ['t.assignee_id = ?', filters.assignee_id],
      ['t.task_date >= ?', filters.from],
      ['t.task_date <= ?', filters.to],
    ]);
    const order = buildOrder('t.task_date', filters.sortDir, ['t.task_date'], 't.task_date');
    const rows = await query(`${BASE_SELECT} ${where} ${order} LIMIT ${limit} OFFSET ${offset}`, params);
    const { total } = await queryOne(`SELECT COUNT(*) AS total FROM task_compliance t ${where}`, params);
    return {
      rows: rows.map(decorate),
      meta: { total, page, limit, pages: Math.ceil(total / limit), summary: await this.summary(filters.cycle_id) },
    };
  },

  /**
   * Dashboard row "ডেইলি টাস্ক কমপ্লায়েন্স রেট" —
   * share of tracked days that scored a full 4/4.
   */
  async summary(cycleId) {
    const rows = await query('SELECT * FROM task_compliance WHERE cycle_id = ?', [cycleId]);
    const perfect = rows.filter((r) => complianceScore(r).score === 4).length;
    const points = rows.reduce((sum, r) => sum + complianceScore(r).score, 0);
    return {
      tracked_days: rows.length,
      perfect_days: perfect,
      compliance_rate: round(safeDiv(perfect, rows.length), 4),
      average_score: round(safeDiv(points, rows.length), 2),
    };
  },

  async getById(id) {
    const row = await queryOne(`${BASE_SELECT} WHERE t.id = ?`, [id]);
    if (!row) throw ApiError.notFound('টাস্ক রেকর্ড পাওয়া যায়নি');
    return decorate(row);
  },

  async create(payload) {
    await cycleService.getById(payload.cycle_id);
    const data = toDbBooleans({
      ...payload,
      owner_label: payload.owner_label ?? null,
      assignee_id: payload.assignee_id ?? null,
      comment: payload.comment ?? null,
    });
    const cols = Object.keys(data);
    const res = await query(
      `INSERT INTO task_compliance (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      Object.values(data),
    );
    return this.getById(res.insertId);
  },

  async update(id, payload) {
    await this.getById(id);
    const data = toDbBooleans(payload);
    const cols = Object.keys(data);
    if (cols.length) {
      await query(`UPDATE task_compliance SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [
        ...Object.values(data),
        id,
      ]);
    }
    return this.getById(id);
  },

  async remove(id) {
    await this.getById(id);
    await query('DELETE FROM task_compliance WHERE id = ?', [id]);
  },
};
