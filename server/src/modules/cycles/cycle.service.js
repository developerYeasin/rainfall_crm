import { cycleRepository } from './cycle.repository.js';
import { clientService } from '../clients/client.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { withTransaction } from '../../db/pool.js';
import { projectWeek, sumProjection, round } from '../../utils/metrics.js';
import { addDays, toDateOnly } from '../../utils/date.js';

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
export const toBnNumber = (n) => String(n).split('').map((d) => BN_DIGITS[Number(d)] ?? d).join('');

/** Default week rows: budget split evenly, exactly like =$B$6/4 in the sheet. */
const defaultWeeks = (cycle) => {
  const perWeek = round(Number(cycle.monthly_budget) / cycle.weeks_count);
  return Array.from({ length: cycle.weeks_count }, (_, i) => ({
    week_no: i + 1,
    label: `সপ্তাহ ${toBnNumber(i + 1)}`,
    start_date: addDays(cycle.month_start, i * 7),
    end_date: addDays(cycle.month_start, i * 7 + 6),
    budget: perWeek,
  }));
};

export const cycleService = {
  list: (filters) => cycleRepository.list(filters),

  async getById(id) {
    const cycle = await cycleRepository.findById(id);
    if (!cycle) throw ApiError.notFound('সাইকেল/মাস পাওয়া যায়নি');
    return { ...cycle, month_start: toDateOnly(cycle.month_start) };
  },

  async create(payload, userId) {
    await clientService.getById(payload.client_id);
    return withTransaction(async (conn) => {
      const id = await cycleRepository.insert({ ...payload, created_by: userId }, conn);
      await cycleRepository.replaceWeeks(id, defaultWeeks({ ...payload, id }), conn);
      return id;
    }).then((id) => this.getById(id));
  },

  async update(id, payload) {
    const current = await this.getById(id);
    await cycleRepository.update(id, payload);
    const next = await this.getById(id);

    // Budget or week count changed -> re-split the weekly budgets, as the sheet would.
    const budgetChanged = payload.monthly_budget !== undefined && Number(payload.monthly_budget) !== Number(current.monthly_budget);
    const weeksChanged = payload.weeks_count !== undefined && Number(payload.weeks_count) !== Number(current.weeks_count);
    const startChanged = payload.month_start !== undefined && payload.month_start !== current.month_start;
    if (budgetChanged || weeksChanged || startChanged) {
      await cycleRepository.replaceWeeks(id, defaultWeeks(next));
    }
    return next;
  },

  async remove(id) {
    await this.getById(id);
    await cycleRepository.remove(id);
  },

  /** "টার্গেট ও প্রজেকশন" — assumptions, weekly rows and the month-total row. */
  async projection(id) {
    const cycle = await this.getById(id);
    let weekRows = await cycleRepository.weeks(id);
    if (!weekRows.length) {
      await cycleRepository.replaceWeeks(id, defaultWeeks(cycle));
      weekRows = await cycleRepository.weeks(id);
    }

    const weeks = weekRows.map((w) => ({
      week_no: w.week_no,
      label: w.label,
      start_date: toDateOnly(w.start_date),
      end_date: toDateOnly(w.end_date),
      ...projectWeek(Number(w.budget), cycle),
    }));

    return {
      cycle,
      assumptions: {
        monthly_budget: Number(cycle.monthly_budget),
        expected_ctr: Number(cycle.expected_ctr),
        expected_cpc: Number(cycle.expected_cpc),
        expected_conversion_rate: Number(cycle.expected_conversion_rate),
        aov: Number(cycle.aov),
      },
      weeks,
      total: { label: `${cycle.name} মোট টার্গেট`, ...sumProjection(weeks) },
    };
  },

  async updateWeek(id, weekNo, payload) {
    await this.getById(id);
    const weeks = await cycleRepository.weeks(id);
    if (!weeks.some((w) => w.week_no === Number(weekNo))) throw ApiError.notFound('সপ্তাহ পাওয়া যায়নি');
    await cycleRepository.updateWeek(id, weekNo, payload);
    return this.projection(id);
  },
};
