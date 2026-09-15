import { query, queryOne } from '../../db/pool.js';
import { ApiError } from '../../utils/ApiError.js';
import { encryptSecret } from '../../utils/crypto.js';
import { andWhere, scopeSql } from '../../utils/access.js';
import { buildWhere } from '../../utils/sql.js';
import { round, safeDiv } from '../../utils/metrics.js';
import { addDays, toDateOnly } from '../../utils/date.js';
import { SOLD_STATUS } from '../../config/constants.js';
import { normaliseAccountId } from './meta.client.js';
import { SPEND_WINDOW_SQL, spendFlag } from './ads.sync.js';

const SOLD_SQL = SOLD_STATUS.map((s) => `'${s}'`).join(', ');
const num = (v) => Number(v || 0);

/** Tokens never leave the server — only whether one is stored. */
const ACCOUNT_SELECT = `
  SELECT a.id, a.client_id, a.platform, a.external_id, a.name, a.currency, a.result_action, a.daily_budget,
         a.assigned_user_id, a.is_active, a.last_synced_at, a.last_sync_error, a.created_at,
         (a.access_token_enc IS NOT NULL) AS has_token,
         c.name AS client_name, u.name AS assigned_user_name,
         COALESCE(w.yesterday_spend, 0) AS yesterday_spend, COALESCE(w.avg_7d, 0) AS avg_7d
  FROM ad_accounts a
  JOIN clients c ON c.id = a.client_id
  LEFT JOIN users u ON u.id = a.assigned_user_id
  LEFT JOIN (${SPEND_WINDOW_SQL}) w ON w.ad_account_id = a.id
`;

const decorateAccount = (a) => {
  const row = {
    ...a,
    is_active: !!a.is_active,
    has_token: !!a.has_token,
    yesterday_spend: round(num(a.yesterday_spend)),
    avg_7d: round(num(a.avg_7d)),
  };
  return { ...row, flag: a.last_synced_at ? spendFlag(row) : null };
};

/** Totals derived the way Ads Manager shows them. */
const withRatios = (r) => {
  const spend = round(num(r.spend));
  const impressions = num(r.impressions);
  const clicks = num(r.clicks);
  const results = num(r.results);
  const value = round(num(r.purchase_value));
  return {
    spend,
    impressions,
    clicks,
    results,
    purchase_value: value,
    ctr: round(safeDiv(clicks, impressions), 6),
    cpc: round(safeDiv(spend, clicks)),
    cost_per_result: round(safeDiv(spend, results)),
    roas: round(safeDiv(value, spend), 2),
  };
};

const GROUP_EXPR = {
  day: 'stat_date',
  week: 'DATE_SUB(stat_date, INTERVAL WEEKDAY(stat_date) DAY)',
  month: "DATE_FORMAT(stat_date, '%Y-%m-01')",
};
const ORDER_GROUP_EXPR = {
  day: 'order_date',
  week: 'DATE_SUB(order_date, INTERVAL WEEKDAY(order_date) DAY)',
  month: "DATE_FORMAT(order_date, '%Y-%m-01')",
};

export const adsService = {
  // ---------------------------------------------------------------- accounts
  async listAccounts(scope, filters = {}) {
    const built = buildWhere([
      ['a.client_id = ?', filters.client_id],
      ['a.platform = ?', filters.platform],
      ['a.assigned_user_id = ?', filters.assigned_user_id],
    ]);
    const where = andWhere(built.sql, scopeSql('a.client_id', scope));
    const rows = await query(`${ACCOUNT_SELECT} ${where} ORDER BY c.name, a.name`, built.params);
    return rows.map(decorateAccount);
  },

  async getAccount(id, scope = null) {
    const where = andWhere('WHERE a.id = ?', scopeSql('a.client_id', scope));
    const row = await queryOne(`${ACCOUNT_SELECT} ${where}`, [id]);
    if (!row) throw ApiError.notFound('অ্যাড অ্যাকাউন্ট পাওয়া যায়নি');
    return decorateAccount(row);
  },

  async ensureStaffUser(userId) {
    if (!userId) return;
    const user = await queryOne("SELECT id FROM users WHERE id = ? AND role <> 'client' AND is_active = 1", [userId]);
    if (!user) throw ApiError.badRequest('শুধু সক্রিয় টিম মেম্বার অ্যাসাইন করা যায়');
  },

  /** Assigning an account also assigns its client, so the buyer can open the client's dashboard. */
  async linkAssignee(clientId, userId) {
    if (userId) await query('INSERT IGNORE INTO client_staff (client_id, user_id) VALUES (?, ?)', [clientId, userId]);
  },

  async createAccount(payload, userId) {
    await this.ensureStaffUser(payload.assigned_user_id);
    const res = await query(
      `INSERT INTO ad_accounts (client_id, platform, external_id, name, currency, access_token_enc, result_action,
                                daily_budget, assigned_user_id, is_active, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.client_id,
        payload.platform,
        normaliseAccountId(payload.external_id),
        payload.name,
        payload.currency || 'BDT',
        encryptSecret(payload.access_token),
        payload.result_action || null,
        payload.daily_budget ?? null,
        payload.assigned_user_id ?? null,
        payload.is_active === false ? 0 : 1,
        userId,
      ],
    );
    await this.linkAssignee(payload.client_id, payload.assigned_user_id);
    return this.getAccount(res.insertId);
  },

  async updateAccount(id, payload, scope) {
    const current = await this.getAccount(id, scope);
    await this.ensureStaffUser(payload.assigned_user_id);
    const patch = { ...payload };
    delete patch.access_token;
    delete patch.client_id;
    if (patch.external_id) patch.external_id = normaliseAccountId(patch.external_id);
    if (payload.access_token) patch.access_token_enc = encryptSecret(payload.access_token);
    if (payload.clear_token) patch.access_token_enc = null;
    delete patch.clear_token;
    if ('is_active' in patch) patch.is_active = patch.is_active ? 1 : 0;

    const cols = Object.keys(patch);
    if (cols.length) {
      await query(`UPDATE ad_accounts SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [
        ...cols.map((c) => (patch[c] === '' ? null : patch[c])),
        id,
      ]);
    }
    await this.linkAssignee(current.client_id, payload.assigned_user_id);
    return this.getAccount(id);
  },

  async removeAccount(id, scope) {
    await this.getAccount(id, scope);
    await query('DELETE FROM ad_accounts WHERE id = ?', [id]);
  },

  // ---------------------------------------------------------------- client dashboard
  /**
   * Ads performance for one client over a date range, grouped by day / week / month,
   * with campaign + ad-set breakdown and a side-by-side of ad spend vs. recorded sales.
   */
  async insights(clientId, { from, to, group = 'day' }) {
    const until = to || toDateOnly(new Date());
    const since = from || addDays(until, -29);
    const bucket = GROUP_EXPR[group] || GROUP_EXPR.day;
    const orderBucket = ORDER_GROUP_EXPR[group] || ORDER_GROUP_EXPR.day;
    const base = [clientId, since, until];

    const [totals, series, campaigns, adsets, salesSeries, salesTotal, accounts] = await Promise.all([
      queryOne(
        `SELECT SUM(spend) AS spend, SUM(impressions) AS impressions, SUM(clicks) AS clicks,
                SUM(results) AS results, SUM(purchase_value) AS purchase_value
         FROM ad_insights WHERE client_id = ? AND level = 'account' AND stat_date BETWEEN ? AND ?`,
        base,
      ),
      query(
        `SELECT ${bucket} AS period, SUM(spend) AS spend, SUM(impressions) AS impressions, SUM(clicks) AS clicks,
                SUM(results) AS results, SUM(purchase_value) AS purchase_value
         FROM ad_insights WHERE client_id = ? AND level = 'account' AND stat_date BETWEEN ? AND ?
         GROUP BY period ORDER BY period`,
        base,
      ),
      query(
        `SELECT object_id, MAX(object_name) AS name, SUM(spend) AS spend, SUM(impressions) AS impressions,
                SUM(clicks) AS clicks, SUM(results) AS results, SUM(purchase_value) AS purchase_value
         FROM ad_insights WHERE client_id = ? AND level = 'campaign' AND stat_date BETWEEN ? AND ?
         GROUP BY object_id ORDER BY spend DESC`,
        base,
      ),
      query(
        `SELECT object_id, parent_id, MAX(object_name) AS name, SUM(spend) AS spend, SUM(impressions) AS impressions,
                SUM(clicks) AS clicks, SUM(results) AS results, SUM(purchase_value) AS purchase_value
         FROM ad_insights WHERE client_id = ? AND level = 'adset' AND stat_date BETWEEN ? AND ?
         GROUP BY object_id, parent_id ORDER BY spend DESC`,
        base,
      ),
      query(
        `SELECT ${orderBucket} AS period, SUM(qty * unit_price - discount) AS revenue, COUNT(*) AS orders
         FROM orders WHERE client_id = ? AND status IN (${SOLD_SQL}) AND order_date BETWEEN ? AND ?
         GROUP BY period`,
        base,
      ),
      queryOne(
        `SELECT COALESCE(SUM(qty * unit_price - discount), 0) AS revenue, COUNT(*) AS orders
         FROM orders WHERE client_id = ? AND status IN (${SOLD_SQL}) AND order_date BETWEEN ? AND ?`,
        base,
      ),
      query(
        `SELECT id, platform, name, external_id, currency, is_active, last_synced_at, last_sync_error
         FROM ad_accounts WHERE client_id = ? ORDER BY name`,
        [clientId],
      ),
    ]);

    const salesByPeriod = new Map(salesSeries.map((s) => [toDateOnly(s.period), s]));
    const periods = new Map(series.map((s) => [toDateOnly(s.period), s]));
    for (const key of salesByPeriod.keys()) if (!periods.has(key)) periods.set(key, {});

    const adTotals = withRatios(totals || {});
    const salesRevenue = round(num(salesTotal.revenue));

    return {
      range: { from: since, to: until, group },
      accounts: accounts.map((a) => ({ ...a, is_active: !!a.is_active })),
      totals: adTotals,
      sales: {
        revenue: salesRevenue,
        orders: num(salesTotal.orders),
        // Real return: what the shop actually sold per taka of ad spend, not the platform's attributed ROAS.
        blended_roas: round(safeDiv(salesRevenue, adTotals.spend), 2),
        roi: round(safeDiv(salesRevenue - adTotals.spend, adTotals.spend), 4),
        cost_per_order: round(safeDiv(adTotals.spend, num(salesTotal.orders))),
      },
      series: [...periods.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, s]) => ({
          period,
          ...withRatios(s),
          sales_revenue: round(num(salesByPeriod.get(period)?.revenue)),
          orders: num(salesByPeriod.get(period)?.orders),
        })),
      campaigns: campaigns.map((c) => ({
        id: c.object_id,
        name: c.name,
        ...withRatios(c),
        adsets: adsets.filter((s) => s.parent_id === c.object_id).map((s) => ({ id: s.object_id, name: s.name, ...withRatios(s) })),
      })),
    };
  },
};
