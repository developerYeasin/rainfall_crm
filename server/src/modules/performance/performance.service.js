import { performanceRepository } from './performance.repository.js';
import { cycleService } from '../cycles/cycle.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { decoratePerformance, summarisePerformance } from '../../utils/metrics.js';
import { weekNoFor, toDateOnly } from '../../utils/date.js';

/** Falls back to deriving the week from the entry date when the client omits it. */
const resolveWeekNo = (payload, cycle) =>
  payload.week_no ?? weekNoFor(payload.entry_date, cycle.month_start, cycle.weeks_count);

export const performanceService = {
  async list(filters) {
    const { rows, meta } = await performanceRepository.list(filters);
    const decorated = rows.map((r) => decoratePerformance({ ...r, entry_date: toDateOnly(r.entry_date) }));
    const all = await performanceRepository.allForCycle(filters.cycle_id);
    return { rows: decorated, meta: { ...meta, totals: summarisePerformance(all) } };
  },

  async getById(id) {
    const row = await performanceRepository.findById(id);
    if (!row) throw ApiError.notFound('এন্ট্রি পাওয়া যায়নি');
    return decoratePerformance({ ...row, entry_date: toDateOnly(row.entry_date) });
  },

  async create(payload, userId) {
    const cycle = await cycleService.getById(payload.cycle_id);
    const id = await performanceRepository.insert({
      ...payload,
      week_no: resolveWeekNo(payload, cycle),
      note: payload.note ?? null,
      created_by: userId,
    });
    return this.getById(id);
  },

  async createMany({ cycle_id, rows }, userId) {
    const cycle = await cycleService.getById(cycle_id);
    const ids = [];
    for (const row of rows) {
      ids.push(
        await performanceRepository.insert({
          ...row,
          cycle_id,
          week_no: resolveWeekNo(row, cycle),
          note: row.note ?? null,
          created_by: userId,
        }),
      );
    }
    return { inserted: ids.length };
  },

  async update(id, payload) {
    const existing = await this.getById(id);
    const patch = { ...payload };
    if (payload.entry_date && payload.week_no === undefined) {
      const cycle = await cycleService.getById(existing.cycle_id);
      patch.week_no = weekNoFor(payload.entry_date, cycle.month_start, cycle.weeks_count);
    }
    await performanceRepository.update(id, patch);
    return this.getById(id);
  },

  async remove(id) {
    await this.getById(id);
    await performanceRepository.remove(id);
  },

  /** Breakdowns used by the dashboard charts. */
  async breakdown(cycleId) {
    await cycleService.getById(cycleId);
    const [platforms, daily] = await Promise.all([
      performanceRepository.platformTotals(cycleId),
      performanceRepository.dailySeries(cycleId),
    ]);
    return {
      platforms: platforms.map((p) => ({
        ...p,
        spend: Number(p.spend),
        revenue: Number(p.revenue),
        roas: Number(p.spend) ? Number((Number(p.revenue) / Number(p.spend)).toFixed(2)) : null,
      })),
      daily: daily.map((d) => ({
        entry_date: toDateOnly(d.entry_date),
        spend: Number(d.spend),
        revenue: Number(d.revenue),
        clicks: Number(d.clicks),
        conversions: Number(d.conversions),
      })),
    };
  },
};
