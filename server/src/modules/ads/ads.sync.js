import { query, queryOne } from '../../db/pool.js';
import { config } from '../../config/index.js';
import { decryptSecret } from '../../utils/crypto.js';
import { addDays, toDateOnly } from '../../utils/date.js';
import { adminIds, notifyUsers } from '../../utils/notify.js';
import * as meta from './meta.client.js';
import * as google from './google.client.js';
import * as tiktok from './tiktok.client.js';

const LEVELS = ['account', 'campaign', 'adset'];
/** Platforms keep revising the last few days (attribution), so every sync re-pulls this window. */
const REFRESH_DAYS = 3;
const BACKFILL_DAYS = 30;
/** TikTok rejects daily reports spanning more than 30 days; every platform uses the same windows. */
const WINDOW_DAYS = 30;
const CHUNK = 200;

/** Each client returns the same row shape: { level, object_id, object_name, parent_id, stat_date, spend, … }. */
const PLATFORMS = {
  meta: { fetchInsights: meta.fetchInsights, envToken: () => config.meta.accessToken },
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

/** Pulls insights for one account and records success/failure on the account row. */
export const syncAccount = async (accountId) => {
  const account = await queryOne('SELECT * FROM ad_accounts WHERE id = ?', [accountId]);
  if (!account) throw new Error('Ad account not found');

  try {
    const platform = PLATFORMS[account.platform];
    if (!platform) throw new Error(`Unsupported platform: ${account.platform}`);
    // Meta/TikTok: access token. Google: OAuth refresh token. Each client explains what is missing.
    const token = decryptSecret(account.access_token_enc) || platform.envToken();
    if (!token && account.platform === 'meta') throw new Error('No Meta access token — add one to the account or set META_ACCESS_TOKEN');

    const until = toDateOnly(new Date());
    const since = addDays(until, -(account.last_synced_at ? REFRESH_DAYS : BACKFILL_DAYS));
    let total = 0;
    for (const level of LEVELS) {
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

export const SPEND_WINDOW_SQL = `
  SELECT ad_account_id,
         COALESCE(SUM(CASE WHEN stat_date = CURDATE() - INTERVAL 1 DAY THEN spend END), 0) AS yesterday_spend,
         COALESCE(SUM(CASE WHEN stat_date BETWEEN CURDATE() - INTERVAL 8 DAY AND CURDATE() - INTERVAL 2 DAY THEN spend END), 0) / 7 AS avg_7d
  FROM ad_insights
  WHERE level = 'account' AND stat_date >= CURDATE() - INTERVAL 8 DAY
  GROUP BY ad_account_id`;

const alertAnomalies = async () => {
  const rows = await query(
    `SELECT a.id, a.name, a.client_id, a.is_active, a.daily_budget, a.assigned_user_id, c.name AS client_name,
            w.yesterday_spend, w.avg_7d
     FROM ad_accounts a
     JOIN clients c ON c.id = a.client_id
     LEFT JOIN (${SPEND_WINDOW_SQL}) w ON w.ad_account_id = a.id
     WHERE a.is_active = 1 AND a.last_synced_at IS NOT NULL`,
  );
  const admins = await adminIds();
  const day = toDateOnly(new Date());
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
