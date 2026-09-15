import { config } from '../../config/index.js';

/**
 * Google Ads API (REST) — daily customer / campaign / ad-group metrics via GAQL searchStream.
 * https://developers.google.com/google-ads/api/rest/overview
 *
 * Auth: agency developer token + OAuth client, and a refresh token (per account, or GOOGLE_ADS_REFRESH_TOKEN).
 */

export const normaliseCustomerId = (id) => String(id).replace(/\D/g, '');

const accessTokens = new Map();

const getAccessToken = async (refreshToken) => {
  const cached = accessTokens.get(refreshToken);
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const { clientId, clientSecret } = config.google;
  if (!clientId || !clientSecret) throw new Error('Google Ads: set GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google OAuth: ${body.error_description || body.error || res.statusText}`);
  accessTokens.set(refreshToken, { token: body.access_token, expires: Date.now() + body.expires_in * 1000 });
  return body.access_token;
};

const LEVELS = {
  account: { from: 'customer', fields: 'customer.id, customer.descriptive_name' },
  campaign: { from: 'campaign', fields: 'campaign.id, campaign.name' },
  adset: { from: 'ad_group', fields: 'ad_group.id, ad_group.name, campaign.id' },
};

export const fetchInsights = async ({ externalId, token, level, since, until }) => {
  if (!config.google.developerToken) throw new Error('Google Ads: set GOOGLE_ADS_DEVELOPER_TOKEN');
  const refreshToken = token || config.google.refreshToken;
  if (!refreshToken) throw new Error('Google Ads: no refresh token — add one to the account or set GOOGLE_ADS_REFRESH_TOKEN');

  const customerId = normaliseCustomerId(externalId);
  const { from, fields } = LEVELS[level];
  const query = `SELECT ${fields}, segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks,
      metrics.conversions, metrics.conversions_value
    FROM ${from}
    WHERE segments.date BETWEEN '${since}' AND '${until}'`;

  const headers = {
    Authorization: `Bearer ${await getAccessToken(refreshToken)}`,
    'developer-token': config.google.developerToken,
    'Content-Type': 'application/json',
  };
  if (config.google.loginCustomerId) headers['login-customer-id'] = normaliseCustomerId(config.google.loginCustomerId);

  const res = await fetch(`https://googleads.googleapis.com/${config.google.apiVersion}/customers/${customerId}/googleAds:searchStream`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(60_000),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = Array.isArray(body) ? body[0]?.error : body?.error;
    throw new Error(`Google Ads API: ${err?.message || res.statusText}`);
  }

  // searchStream returns an array of batches, each with `results`.
  return (body || []).flatMap((batch) =>
    (batch.results || []).map((r) => ({
      level,
      object_id: level === 'account' ? customerId : level === 'campaign' ? String(r.campaign.id) : String(r.adGroup.id),
      object_name: level === 'account' ? null : level === 'campaign' ? r.campaign.name : r.adGroup.name,
      parent_id: level === 'adset' ? String(r.campaign.id) : null,
      stat_date: r.segments.date,
      spend: Number(r.metrics.costMicros || 0) / 1_000_000,
      impressions: Number(r.metrics.impressions || 0),
      clicks: Number(r.metrics.clicks || 0),
      results: Math.round(Number(r.metrics.conversions || 0)),
      purchase_value: Number(r.metrics.conversionsValue || 0),
    })),
  );
};
