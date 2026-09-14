import { WEEK_STATUS, COMPLIANCE_FIELDS } from '../config/constants.js';

/** IFERROR(a/b, "") — returns null instead of an error when b is 0/invalid. */
export const safeDiv = (a, b) => {
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y) || y === 0) return null;
  return x / y;
};

export const round = (n, dp = 2) =>
  n === null || n === undefined || !Number.isFinite(Number(n))
    ? null
    : Math.round(Number(n) * 10 ** dp) / 10 ** dp;

/**
 * "টার্গেট ও প্রজেকশন" sheet, rows 15-18.
 *   clicks       = budget / cpc
 *   impressions  = clicks / ctr
 *   conversions  = clicks * conversionRate
 *   revenue      = conversions * aov
 *   roas         = revenue / budget
 */
export const projectWeek = (budget, assumptions) => {
  const { expected_cpc, expected_ctr, expected_conversion_rate, aov } = assumptions;
  const clicks = safeDiv(budget, expected_cpc);
  const impressions = safeDiv(clicks, expected_ctr);
  const conversions = clicks === null ? null : clicks * Number(expected_conversion_rate);
  const revenue = conversions === null ? null : conversions * Number(aov);
  return {
    budget: round(budget),
    clicks: round(clicks, 0),
    impressions: round(impressions, 0),
    conversions: round(conversions, 0),
    revenue: round(revenue),
    roas: round(safeDiv(revenue, budget), 2),
  };
};

/** Row 19 — the month total, summed from the weekly rows. */
export const sumProjection = (weeks) => {
  const total = weeks.reduce(
    (acc, w) => ({
      budget: acc.budget + (w.budget || 0),
      clicks: acc.clicks + (w.clicks || 0),
      impressions: acc.impressions + (w.impressions || 0),
      conversions: acc.conversions + (w.conversions || 0),
      revenue: acc.revenue + (w.revenue || 0),
    }),
    { budget: 0, clicks: 0, impressions: 0, conversions: 0, revenue: 0 },
  );
  return { ...total, roas: round(safeDiv(total.revenue, total.budget), 2) };
};

/** "পারফরম্যান্স ট্র্যাকার" — derived columns G, H, K on each row. */
export const decoratePerformance = (row) => ({
  ...row,
  spend: Number(row.spend),
  revenue: Number(row.revenue),
  ctr: round(safeDiv(row.clicks, row.impressions), 6),
  cpc: round(safeDiv(row.spend, row.clicks), 2),
  roas: round(safeDiv(row.revenue, row.spend), 2),
});

/** Row 37 — totals/averages across all performance rows. */
export const summarisePerformance = (rows) => {
  const t = rows.reduce(
    (acc, r) => ({
      spend: acc.spend + Number(r.spend || 0),
      impressions: acc.impressions + Number(r.impressions || 0),
      clicks: acc.clicks + Number(r.clicks || 0),
      conversions: acc.conversions + Number(r.conversions || 0),
      revenue: acc.revenue + Number(r.revenue || 0),
    }),
    { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 },
  );
  return {
    ...t,
    spend: round(t.spend),
    revenue: round(t.revenue),
    ctr: round(safeDiv(t.clicks, t.impressions), 6),
    cpc: round(safeDiv(t.spend, t.clicks), 2),
    roas: round(safeDiv(t.revenue, t.spend), 2),
  };
};

/**
 * "কন্ট্রোল ইন্সপেকশন শীট" column G:
 *   IFS(actual=0,"ডেটা নেই", var>=0,"এগিয়ে", var>=-0.1,"সামান্য পিছিয়ে", TRUE,"পিছিয়ে")
 */
export const weekStatus = (actualRevenue, variancePct) => {
  if (!actualRevenue) return WEEK_STATUS.NO_DATA;
  if (variancePct === null) return WEEK_STATUS.NO_DATA;
  if (variancePct >= 0) return WEEK_STATUS.ON_TRACK;
  if (variancePct >= -0.1) return WEEK_STATUS.SLIGHTLY_BEHIND;
  return WEEK_STATUS.BEHIND;
};

export const buildVariance = (targetRevenue, actualRevenue, targetRoas) => {
  const variance = Number(actualRevenue || 0) - Number(targetRevenue || 0);
  const variancePct = safeDiv(variance, targetRevenue);
  return {
    target_revenue: round(targetRevenue),
    actual_revenue: round(actualRevenue),
    variance: round(variance),
    variance_pct: round(variancePct, 4),
    target_roas: round(targetRoas, 2),
    status: weekStatus(Number(actualRevenue || 0), variancePct),
  };
};

/** "ডেইলি টাস্ক কমপ্লায়েন্স" column H — CONCAT(SUM(...),"/4"). */
export const complianceScore = (row) => {
  const score = COMPLIANCE_FIELDS.reduce((n, f) => n + (row[f] ? 1 : 0), 0);
  return { score, total: COMPLIANCE_FIELDS.length, label: `${score}/${COMPLIANCE_FIELDS.length}` };
};
