import { cycleService } from '../cycles/cycle.service.js';
import { controlService } from '../control/control.service.js';
import { taskService } from '../tasks/task.service.js';
import { performanceRepository } from '../performance/performance.repository.js';
import { performanceService } from '../performance/performance.service.js';
import { summarisePerformance, round, safeDiv } from '../../utils/metrics.js';
import { query } from '../../db/pool.js';
import { scopeSql } from '../../utils/access.js';

export const dashboardService = {
  /** "ড্যাশবোর্ড সামারি" — every metric row, plus the weekly status strip. */
  async cycleSummary(cycleId) {
    const [projection, inspection, entries, compliance, reported, breakdown, contentCounts] = await Promise.all([
      cycleService.projection(cycleId),
      controlService.inspection(cycleId),
      performanceRepository.allForCycle(cycleId),
      taskService.summary(cycleId),
      performanceRepository.reportedDays(cycleId),
      performanceService.breakdown(cycleId),
      query('SELECT status, COUNT(*) AS total FROM content_calendar WHERE cycle_id = ? GROUP BY status', [cycleId]),
    ]);

    const actual = summarisePerformance(entries);
    const targetRevenue = projection.total.revenue;

    return {
      cycle: projection.cycle,
      metrics: {
        target_revenue: targetRevenue,
        actual_revenue: actual.revenue,
        achievement_pct: round(safeDiv(actual.revenue, targetRevenue), 4),
        total_spend: actual.spend,
        actual_roas: actual.roas,
        target_roas: projection.total.roas,
        total_conversions: actual.conversions,
        total_clicks: actual.clicks,
        total_impressions: actual.impressions,
        actual_ctr: actual.ctr,
        actual_cpc: actual.cpc,
        compliance_rate: compliance.compliance_rate,
        tracked_days: compliance.tracked_days,
        reported_days: Number(reported?.days || 0),
        budget_utilisation: round(safeDiv(actual.spend, projection.total.budget), 4),
        remaining_budget: round(projection.total.budget - actual.spend),
      },
      target: projection.total,
      weeks: inspection.weeks,
      platforms: breakdown.platforms,
      daily: breakdown.daily,
      content: contentCounts,
    };
  },

  /** Agency-wide roll-up across every client with a running cycle. */
  async overview(scope = null) {
    const clientScope = scopeSql('id', scope);
    const cycleScope = scopeSql('cy.client_id', scope);
    const [clientStats] = await query(
      `SELECT COUNT(*) AS total_clients,
              SUM(status = 'active') AS active_clients,
              SUM(status = 'onboarding') AS onboarding_clients,
              SUM(status = 'lead') AS leads
       FROM clients ${clientScope ? `WHERE ${clientScope}` : ''}`,
    );

    const [totals] = await query(
      `SELECT COALESCE(SUM(p.spend), 0) AS spend,
              COALESCE(SUM(p.revenue), 0) AS revenue,
              COALESCE(SUM(p.conversions), 0) AS conversions
       FROM performance_entries p
       JOIN cycles cy ON cy.id = p.cycle_id
       WHERE cy.status = 'running' ${cycleScope ? `AND ${cycleScope}` : ''}`,
    );

    const perClient = await query(
      `SELECT c.id AS client_id, c.name AS client_name, cy.id AS cycle_id, cy.name AS cycle_name,
              cy.month_start, cy.monthly_budget,
              COALESCE(SUM(p.spend), 0) AS spend,
              COALESCE(SUM(p.revenue), 0) AS revenue,
              COALESCE(SUM(p.conversions), 0) AS conversions
       FROM cycles cy
       JOIN clients c ON c.id = cy.client_id
       LEFT JOIN performance_entries p ON p.cycle_id = cy.id
       WHERE cy.status = 'running' ${cycleScope ? `AND ${cycleScope}` : ''}
       GROUP BY cy.id
       ORDER BY revenue DESC`,
    );

    const rows = [];
    for (const row of perClient) {
      const projection = await cycleService.projection(row.cycle_id);
      rows.push({
        ...row,
        spend: Number(row.spend),
        revenue: Number(row.revenue),
        target_revenue: projection.total.revenue,
        achievement_pct: round(safeDiv(Number(row.revenue), projection.total.revenue), 4),
        roas: round(safeDiv(Number(row.revenue), Number(row.spend)), 2),
      });
    }

    return {
      clients: {
        total: Number(clientStats.total_clients),
        active: Number(clientStats.active_clients || 0),
        onboarding: Number(clientStats.onboarding_clients || 0),
        leads: Number(clientStats.leads || 0),
      },
      totals: {
        spend: round(Number(totals.spend)),
        revenue: round(Number(totals.revenue)),
        conversions: Number(totals.conversions),
        roas: round(safeDiv(Number(totals.revenue), Number(totals.spend)), 2),
      },
      running_cycles: rows,
    };
  },
};
