import { query, queryOne } from '../../db/pool.js';
import { config } from '../../config/index.js';
import { decryptSecret } from '../../utils/crypto.js';
import { addDays, todayIn } from '../../utils/date.js';
import { round, safeDiv } from '../../utils/metrics.js';
import { adminIds, clientStaffIds, clientUserIds, notifyUsers } from '../../utils/notify.js';
import { agencyMetaToken } from '../settings/meta.settings.js';
import * as meta from './meta.client.js';
import * as google from './google.client.js';
import * as tiktok from './tiktok.client.js';

const LEVELS = ['account', 'campaign', 'adset'];
/** Meta also reports every individual ad, so clients see which creative works and what it costs. */
const META_LEVELS = [...LEVELS, 'ad'];
/** Platforms keep revising the last few days (attribution), so every sync re-pulls this window. */
const REFRESH_DAYS = 3;
const BACKFILL_DAYS = 30;
/** TikTok rejects daily reports spanning more than 30 days; every platform uses the same windows. */
const WINDOW_DAYS = 30;
const CHUNK = 200;

/** Each client returns the same row shape: { level, object_id, object_name, parent_id, stat_date, spend, … }. */
const PLATFORMS = {
  // The agency token from the Meta setup page (or META_ACCESS_TOKEN).
  meta: { fetchInsights: meta.fetchInsights, envToken: agencyMetaToken },
  google: { fetchInsights: google.fetchInsights, envToken: () => config.google.refreshToken },
  tiktok: { fetchInsights: tiktok.fetchInsights, envToken: () => config.tiktok.accessToken },
};

const dateWindows = (since, until) => {
  const windows = [];
  for (let start = since; start <= until; start = addDays(start, WINDOW_DAYS)) {
    const end = addDays(start, WINDOW_DAYS - 1);
    windows.push([start, end < until ? end : until]);
  }
  return windows;
};

const upsertRows = async (account, rows) => {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const params = chunk.flatMap((r) => [
      account.id,
      account.client_id,
      r.level,
      r.object_id,
      r.object_name,
      r.parent_id,
      r.stat_date,
      r.spend,
      r.impressions,
      r.clicks,
      r.results,
      r.purchase_value,
    ]);
    await query(
      `INSERT INTO ad_insights (ad_account_id, client_id, level, object_id, object_name, parent_id, stat_date,
                                spend, impressions, clicks, results, purchase_value)
       VALUES ${chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}
       ON DUPLICATE KEY UPDATE object_name = VALUES(object_name), parent_id = VALUES(parent_id),
         spend = VALUES(spend), impressions = VALUES(impressions), clicks = VALUES(clicks),
         results = VALUES(results), purchase_value = VALUES(purchase_value)`,
      params,
    );
  }
};

/** "Today" in the agency's reporting zone (Asia/Dhaka by default), whatever the server's clock zone is. */
export const reportToday = () => todayIn(config.jobs.timezone);

const pullAll = async (platform, account, token, since, until) => {
  let total = 0;
  for (const level of account.platform === 'meta' ? META_LEVELS : LEVELS) {
    for (const [from, to] of dateWindows(since, until)) {
      const rows = await platform.fetchInsights({
        externalId: account.external_id,
        token,
        level,
        since: from,
        until: to,
        resultAction: account.result_action,
      });
      await upsertRows(account, rows);
      total += rows.length;
    }
  }
  return total;
};

/** Pulls insights for one account and records success/failure on the account row. */
export const syncAccount = async (accountId) => {
  const account = await queryOne('SELECT * FROM ad_accounts WHERE id = ?', [accountId]);
  if (!account) throw new Error('Ad account not found');

  try {
    const platform = PLATFORMS[account.platform];
    if (!platform) throw new Error(`Unsupported platform: ${account.platform}`);
    // Meta/TikTok: access token. Google: OAuth refresh token. Each client explains what is missing.
    const ownToken = decryptSecret(account.access_token_enc);
    const fallbackToken = await platform.envToken();
    const token = ownToken || fallbackToken;
    if (!token && account.platform === 'meta') {
      throw new Error('Meta অ্যাক্সেস টোকেন নেই — অ্যাডমিন প্যানেলের "Meta সেটআপ" পেজে টোকেন দিন');
    }

    const until = reportToday();
    const since = addDays(until, -(account.last_synced_at ? REFRESH_DAYS : BACKFILL_DAYS));
    let total;
    try {
      total = await pullAll(platform, account, token, since, until);
    } catch (err) {
      // An account's own token expired but the agency token is fine: carry on with the agency one.
      if (!err.authError || !ownToken || !fallbackToken || fallbackToken === ownToken) throw err;
      total = await pullAll(platform, account, fallbackToken, since, until);
    }
    await query('UPDATE ad_accounts SET last_synced_at = NOW(), last_sync_error = NULL WHERE id = ?', [account.id]);
    return { account_id: account.id, rows: total, since, until };
  } catch (err) {
    await query('UPDATE ad_accounts SET last_sync_error = ? WHERE id = ?', [err.message.slice(0, 500), account.id]);
    throw err;
  }
};

/**
 * Yesterday's spend against the daily budget (or the prior 7-day average when no budget is set).
 *   no_delivery → nothing spent although it normally spends
 *   overspend   → > 125% of reference
 *   underspend  → < 50% of reference
 */
export const spendFlag = ({ is_active, daily_budget, yesterday_spend, avg_7d }) => {
  if (!is_active) return null;
  const reference = Number(daily_budget) || Number(avg_7d) || 0;
  if (!reference) return null;
  const y = Number(yesterday_spend) || 0;
  if (y === 0) return 'no_delivery';
  if (y > reference * 1.25) return 'overspend';
  if (y < reference * 0.5) return 'underspend';
  return null;
};

/** Yesterday / prior-7-day spend per account, relative to "today" in the reporting zone. */
export const spendWindowSql = () => {
  const today = reportToday(); // always YYYY-MM-DD from Intl, safe to inline
  return `
  SELECT ad_account_id,
         COALESCE(SUM(CASE WHEN stat_date = DATE('${today}') - INTERVAL 1 DAY THEN spend END), 0) AS yesterday_spend,
         COALESCE(SUM(CASE WHEN stat_date BETWEEN DATE('${today}') - INTERVAL 8 DAY AND DATE('${today}') - INTERVAL 2 DAY THEN spend END), 0) / 7 AS avg_7d
  FROM ad_insights
  WHERE level = 'account' AND stat_date >= DATE('${today}') - INTERVAL 8 DAY
  GROUP BY ad_account_id`;
};

const alertAnomalies = async () => {
  const rows = await query(
    `SELECT a.id, a.name, a.client_id, a.is_active, a.daily_budget, a.assigned_user_id, c.name AS client_name,
            w.yesterday_spend, w.avg_7d
     FROM ad_accounts a
     JOIN clients c ON c.id = a.client_id
     LEFT JOIN (${spendWindowSql()}) w ON w.ad_account_id = a.id
     WHERE a.is_active = 1 AND a.last_synced_at IS NOT NULL`,
  );
  const admins = await adminIds();
  const day = reportToday();
  for (const row of rows) {
    const flag = spendFlag(row);
    if (!flag) continue;
    await notifyUsers([...admins, row.assigned_user_id], {
      type: 'spend_alert',
      data: { account: row.name, client: row.client_name, flag, spend: Number(row.yesterday_spend) },
      link: '/ad-accounts',
      clientId: row.client_id,
      dedupeKey: `spend-${row.id}-${day}`,
    });
  }
};

/** Syncs a client's accounts that haven't synced in the last `freshMinutes` (portal "refresh now"). */
export const syncClientAccounts = async (clientId, { freshMinutes = 5 } = {}) => {
  const accounts = await query(
    `SELECT id FROM ad_accounts WHERE client_id = ? AND is_active = 1
       AND (last_synced_at IS NULL OR last_synced_at < NOW() - INTERVAL ? MINUTE)`,
    [clientId, freshMinutes],
  );
  const results = { ok: 0, failed: 0, errors: [] };
  for (const { id } of accounts) {
    try {
      await syncAccount(id);
      results.ok += 1;
    } catch (err) {
      results.failed += 1;
      results.errors.push(err.message);
    }
  }
  return results;
};

/** Scheduled job: sync every active account, then raise spend alerts. One failure never stops the rest. */
export const syncAllAccounts = async () => {
  const accounts = await query('SELECT id FROM ad_accounts WHERE is_active = 1');
  const results = { ok: 0, failed: 0 };
  for (const { id } of accounts) {
    try {
      await syncAccount(id);
      results.ok += 1;
    } catch (err) {
      results.failed += 1;
      console.error(`[ads-sync] account ${id}: ${err.message}`);
    }
  }
  await alertAnomalies();
  return results;
};

/**
 * One client's whole-day ad numbers (account level, every connected account added up),
 * shaped like Ads Manager's summary row.
 */
export const dayTotals = async (clientId, day) => {
  const row = await queryOne(
    `SELECT COALESCE(SUM(spend), 0) AS spend, COALESCE(SUM(impressions), 0) AS impressions, COALESCE(SUM(clicks), 0) AS clicks,
            COALESCE(SUM(results), 0) AS results, COALESCE(SUM(purchase_value), 0) AS purchase_value, COUNT(*) AS rows_count
     FROM ad_insights WHERE client_id = ? AND level = 'account' AND stat_date = ?`,
    [clientId, day],
  );
  const spend = round(Number(row.spend));
  const clicks = Number(row.clicks);
  const impressions = Number(row.impressions);
  const results = Number(row.results);
  const value = round(Number(row.purchase_value));
  return {
    date: day,
    has_data: Number(row.rows_count) > 0,
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

/**
 * Midnight job: pull the day that just ended from every ad account, then give each client
 * (and the staff on it) that day's spend and results — in the bell, and by email when SMTP is set.
 * Deduped per client per day, so a restart or a second instance never sends it twice.
 */
export const dailyAdReport = async () => {
  const sync = await syncAllAccounts();
  const day = addDays(reportToday(), -1);
  const clients = await query(
    'SELECT DISTINCT c.id, c.name FROM clients c JOIN ad_accounts a ON a.client_id = c.id AND a.is_active = 1',
  );
  let sent = 0;
  for (const client of clients) {
    const dedupeKey = `daily-ads-${client.id}-${day}`;
    // Notifications dedupe themselves; this also stops a second email after a restart.
    if (await queryOne('SELECT 1 FROM notifications WHERE dedupe_key = ? LIMIT 1', [dedupeKey])) continue;
    const totals = await dayTotals(client.id, day);
    if (!totals.has_data) continue;
    const data = {
      client: client.name,
      date: day,
      spend: totals.spend,
      results: totals.results,
      cost_per_result: totals.cost_per_result,
      clicks: totals.clicks,
    };
    const common = { type: 'daily_ad_report', data, link: 'business:ads', clientId: client.id, dedupeKey };
    await notifyUsers(await clientUserIds(client.id), {
      ...common,
      email: {
        subject: `Ads report for ${day}: BDT ${totals.spend} spent, ${totals.results} results`,
        text: [
          `${client.name} — ads performance for ${day}`,
          '',
          `Spend: BDT ${totals.spend}`,
          `Results: ${totals.results} (BDT ${totals.cost_per_result} per result)`,
          `Clicks: ${totals.clicks} · CTR ${(totals.ctr * 100).toFixed(2)}% · CPC BDT ${totals.cpc}`,
          `Impressions: ${totals.impressions}`,
          '',
          `Full report: ${config.jobs.appUrl}/business/ads`,
        ].join('\n'),
      },
    });
    await notifyUsers(await clientStaffIds(client.id), common);
    sent += 1;
  }
  return { day, reports: sent, synced: sync.ok, sync_failed: sync.failed };
};
