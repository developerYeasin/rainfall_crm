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

const graphGet = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    throw new Error(`Meta API: ${body.error?.message || res.statusText}`);
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

export const oauthConfigured = () => Boolean(config.meta.appId && config.meta.appSecret);

/** Facebook login dialog asking for read access to the user's ad accounts. */
export const oauthDialogUrl = ({ redirectUri, state }) =>
  `${oauthBase()}?${new URLSearchParams({
    client_id: config.meta.appId,
    redirect_uri: redirectUri,
    state,
    scope: 'ads_read,business_management',
    response_type: 'code',
  })}`;

/** Code → short-lived token → long-lived (~60 day) token. */
export const exchangeCode = async ({ code, redirectUri }) => {
  const short = await graphGet(
    `${BASE()}/oauth/access_token?${new URLSearchParams({
      client_id: config.meta.appId,
      client_secret: config.meta.appSecret,
      redirect_uri: redirectUri,
      code,
    })}`,
  );
  const long = await graphGet(
    `${BASE()}/oauth/access_token?${new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: config.meta.appId,
      client_secret: config.meta.appSecret,
      fb_exchange_token: short.access_token,
    })}`,
  ).catch(() => short);
  return long.access_token;
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
