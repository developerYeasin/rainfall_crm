import { config } from '../../config/index.js';

/**
 * Minimal Meta Marketing API client — only the Insights edge the dashboard needs.
 * https://developers.facebook.com/docs/marketing-api/insights
 */

const BASE = () => `https://graph.facebook.com/${config.meta.apiVersion}`;

const LEVEL_FIELDS = {
  account: ['account_id', 'account_name'],
  campaign: ['campaign_id', 'campaign_name'],
  adset: ['adset_id', 'adset_name', 'campaign_id'],
  ad: ['ad_id', 'ad_name', 'adset_id', 'campaign_id'],
};
/** Each level's rows point at the level above: ad → ad set → campaign. */
const PARENT_KEY = { adset: 'campaign_id', ad: 'adset_id' };
const METRIC_FIELDS = ['spend', 'impressions', 'clicks', 'actions', 'action_values'];

/** When an account has no explicit result action, the first one present wins. */
const RESULT_PRIORITY = [
  'omni_purchase',
  'purchase',
  'offsite_conversion.fb_pixel_purchase',
  'lead',
  'onsite_conversion.lead_grouped',
  'onsite_conversion.messaging_conversation_started_7d',
  'link_click',
];
const PURCHASE_VALUE_KEYS = ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'];

export const normaliseAccountId = (id) => String(id).trim().replace(/^act_/, '');

const actionValue = (list, type) => Number((list || []).find((a) => a.action_type === type)?.value || 0);

const pickResults = (actions, resultAction) => {
  if (resultAction) return actionValue(actions, resultAction);
  const found = RESULT_PRIORITY.find((type) => actionValue(actions, type) > 0);
  return found ? actionValue(actions, found) : 0;
};

/** Codes Meta uses for a dead, expired or revoked token (the fix is always a new token). */
const AUTH_CODES = new Set([102, 190, 463, 467]);

/** Turns a Graph API error into a message the admin can act on. */
const explain = (error) => {
  const code = Number(error?.code);
  const msg = error?.message || 'unknown error';
  if (AUTH_CODES.has(code)) return `টোকেনের মেয়াদ শেষ বা বাতিল — Meta সেটআপে নতুন টোকেন দিন (${msg})`;
  if ([10, 200, 294].includes(code) || /ads_read|ads_management|permission/i.test(msg)) {
    return `টোকেনে ads_read পারমিশন নেই বা এই অ্যাড অ্যাকাউন্টে অ্যাক্সেস নেই (${msg})`;
  }
  if ([4, 17, 32, 613, 80000, 80004].includes(code)) return `Meta API লিমিট — কিছুক্ষণ পরে আবার সিঙ্ক হবে (${msg})`;
  return msg;
};

const graphGet = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    const err = new Error(`Meta API: ${body.error ? explain(body.error) : res.statusText}`);
    err.metaCode = Number(body.error?.code) || null;
    err.authError = AUTH_CODES.has(err.metaCode);
    throw err;
  }
  return body;
};

/** Daily rows for one level over [since, until], following pagination. */
export const fetchInsights = async ({ externalId, token, level, since, until, resultAction }) => {
  const params = new URLSearchParams({
    level,
    fields: [...LEVEL_FIELDS[level], ...METRIC_FIELDS].join(','),
    time_range: JSON.stringify({ since, until }),
    time_increment: '1',
    limit: '500',
    access_token: token,
  });
  let url = `${BASE()}/act_${normaliseAccountId(externalId)}/insights?${params}`;
  const rows = [];

  while (url) {
    const page = await graphGet(url);
    for (const r of page.data || []) {
      rows.push({
        level,
        object_id: level === 'account' ? normaliseAccountId(externalId) : r[`${level}_id`],
        object_name: r[`${level}_name`] ?? null,
        parent_id: PARENT_KEY[level] ? r[PARENT_KEY[level]] : null,
        stat_date: r.date_start,
        spend: Number(r.spend || 0),
        impressions: Number(r.impressions || 0),
        clicks: Number(r.clicks || 0),
        results: Math.round(pickResults(r.actions, resultAction)),
        purchase_value: PURCHASE_VALUE_KEYS.reduce((max, k) => Math.max(max, actionValue(r.action_values, k)), 0),
      });
    }
    url = page.paging?.next || null;
  }
  return rows;
};

/** Lightweight token/account check used when an account is connected. */
export const fetchAccountInfo = async ({ externalId, token }) =>
  graphGet(
    `${BASE()}/act_${normaliseAccountId(externalId)}?${new URLSearchParams({
      fields: 'name,currency,account_status',
      access_token: token,
    })}`,
  );

const oauthBase = () => `https://www.facebook.com/${config.meta.apiVersion}/dialog/oauth`;

/** Facebook login dialog asking for read access to the user's ad accounts. `app` = { appId, appSecret }. */
export const oauthDialogUrl = ({ app, redirectUri, state }) =>
  `${oauthBase()}?${new URLSearchParams({
    client_id: app.appId,
    redirect_uri: redirectUri,
    state,
    scope: 'ads_read,business_management',
    response_type: 'code',
  })}`;

/**
 * Short-lived user token (Graph API Explorer, ~1–2 hours) → long-lived (~60 days).
 * System-user tokens are already permanent; Meta rejects the exchange for them, so null means "keep it".
 */
export const extendToken = async ({ app, token }) => {
  if (!app?.appId || !app?.appSecret) return null;
  try {
    const long = await graphGet(
      `${BASE()}/oauth/access_token?${new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: app.appId,
        client_secret: app.appSecret,
        fb_exchange_token: token,
      })}`,
    );
    return long.access_token || null;
  } catch {
    return null;
  }
};

/** Code → short-lived token → long-lived (~60 day) token. */
export const exchangeCode = async ({ app, code, redirectUri }) => {
  const short = await graphGet(
    `${BASE()}/oauth/access_token?${new URLSearchParams({
      client_id: app.appId,
      client_secret: app.appSecret,
      redirect_uri: redirectUri,
      code,
    })}`,
  );
  return (await extendToken({ app, token: short.access_token })) || short.access_token;
};

/**
 * What a token is: whose it is, which permissions it carries and when it expires.
 * `debug_token` needs the app's id + secret; without them expiry is simply unknown.
 */
export const inspectToken = async ({ app, token }) => {
  const me = await graphGet(`${BASE()}/me?${new URLSearchParams({ fields: 'id,name', access_token: token })}`);
  const info = { owner_id: me.id, owner_name: me.name || null, type: null, expires_at: null, expiry_known: false, scopes: [], app_id: null };

  if (app?.appId && app?.appSecret) {
    const debug = await graphGet(
      `${BASE()}/debug_token?${new URLSearchParams({ input_token: token, access_token: `${app.appId}|${app.appSecret}` })}`,
    ).catch(() => null);
    const d = debug?.data;
    if (d) {
      info.expiry_known = true;
      info.type = d.type || null;
      info.app_id = d.app_id || null;
      // 0 = never expires (system users).
      info.expires_at = d.expires_at ? new Date(d.expires_at * 1000).toISOString() : null;
      info.scopes = d.scopes || [];
    }
  }
  if (!info.scopes.length) {
    const perms = await graphGet(`${BASE()}/me/permissions?${new URLSearchParams({ access_token: token })}`).catch(() => null);
    info.scopes = (perms?.data || []).filter((p) => p.status === 'granted').map((p) => p.permission);
  }
  return info;
};

/** Every ad account the token can read. */
export const listAdAccounts = async (token) => {
  const accounts = [];
  let url = `${BASE()}/me/adaccounts?${new URLSearchParams({
    fields: 'account_id,name,currency,account_status,business{name}',
    limit: '200',
    access_token: token,
  })}`;
  while (url) {
    const page = await graphGet(url);
    for (const a of page.data || []) {
      accounts.push({
        external_id: a.account_id,
        name: a.name,
        currency: a.currency,
        active: a.account_status === 1,
        business: a.business?.name || null,
      });
    }
    url = page.paging?.next || null;
  }
  return accounts;
};
