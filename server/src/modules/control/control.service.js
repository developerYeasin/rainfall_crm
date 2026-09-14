import { cycleService } from '../cycles/cycle.service.js';
import { performanceRepository } from '../performance/performance.repository.js';
import { buildVariance, round, safeDiv } from '../../utils/metrics.js';

export const controlService = {
  /**
   * "কন্ট্রোল ইন্সপেকশন শীট" — per week: target revenue (from the projection),
   * actual revenue (SUMIFS over the tracker), variance, variance % and status flag.
   */
  async inspection(cycleId) {
    const projection = await cycleService.projection(cycleId);
    const actuals = await performanceRepository.weeklyTotals(cycleId);
    const actualByWeek = new Map(actuals.map((a) => [Number(a.week_no), a]));

    const weeks = projection.weeks.map((week) => {
      const actual = actualByWeek.get(week.week_no);
      const actualRevenue = Number(actual?.revenue || 0);
      const actualSpend = Number(actual?.spend || 0);
      return {
        week_no: week.week_no,
        label: week.label,
        ...buildVariance(week.revenue, actualRevenue, week.roas),
        actual_spend: round(actualSpend),
        actual_roas: round(safeDiv(actualRevenue, actualSpend), 2),
        actual_conversions: Number(actual?.conversions || 0),
        target_conversions: week.conversions,
      };
    });

    const targetTotal = projection.total.revenue;
    const actualTotal = weeks.reduce((sum, w) => sum + (w.actual_revenue || 0), 0);

    return {
      cycle: projection.cycle,
      weeks,
      total: {
        label: `${projection.cycle.name} মোট`,
        ...buildVariance(targetTotal, actualTotal, projection.total.roas),
      },
    };
  },
};
