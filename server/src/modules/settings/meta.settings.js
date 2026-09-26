import { query } from '../../db/pool.js';
import { config } from '../../config/index.js';
import { encryptSecret, decryptSecret } from '../../utils/crypto.js';
import * as meta from '../ads/meta.client.js';

/**
 * Meta (Facebook) app credentials and the agency access token.
 * The admin enters them on the Meta setup page; they are stored encrypted in app_settings and win
 * over META_APP_ID / META_APP_SECRET / META_ACCESS_TOKEN in .env, which stay as a fallback.
 */
const KEYS = { appId: 'meta.app_id', appSecret: 'meta.app_secret', accessToken: 'meta.access_token' };

let cache = null;
let cachedAt = 0;
const TTL_MS = 60_000;

const readStored = async () => {
  const rows = await query('SELECT setting_key, value_enc FROM app_settings WHERE setting_key IN (?, ?, ?)', Object.values(KEYS));
  const byKey = new Map(rows.map((r) => [r.setting_key, r.value_enc]));
  const out = {};
  for (const [name, key] of Object.entries(KEYS)) {
    try {
      out[name] = decryptSecret(byKey.get(key)) || null;
    } catch {
      // Encrypted under an older CREDENTIALS_KEY — treat as missing so the admin re-enters it.
      out[name] = null;
    }
  }
  return out;
};

/** { appId, appSecret, accessToken, source: { appId: 'app'|'env'|null, … } } */
export const getMetaSettings = async ({ fresh = false } = {}) => {
  if (!fresh && cache && Date.now() - cachedAt < TTL_MS) return cache;
  const stored = await readStored();
  const env = { appId: config.meta.appId, appSecret: config.meta.appSecret, accessToken: config.meta.accessToken };
  const resolved = { source: {} };
  for (const name of Object.keys(KEYS)) {
    resolved[name] = stored[name] || env[name] || null;
    resolved.source[name] = stored[name] ? 'app' : env[name] ? 'env' : null;
  }
  cache = resolved;
  cachedAt = Date.now();
  return resolved;
};

/** The agency token used for every Meta account without a token of its own. */
export const agencyMetaToken = async () => (await getMetaSettings()).accessToken;

export const metaApp = async () => {
  const s = await getMetaSettings();
  return { appId: s.appId, appSecret: s.appSecret };
};

export const oauthConfigured = async () => {
  const { appId, appSecret } = await metaApp();
  return Boolean(appId && appSecret);
};

const writeKey = (key, value, userId) =>
  query(
    `INSERT INTO app_settings (setting_key, value_enc, updated_by) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE value_enc = VALUES(value_enc), updated_by = VALUES(updated_by)`,
    [key, encryptSecret(value), userId],
  );

/**
 * Saves whichever fields were sent ('' clears one). A pasted short-lived token is swapped for a
 * ~60-day one when the app id + secret are known, so the midnight sync does not die after an hour.
 */
export const saveMetaSettings = async ({ app_id, app_secret, access_token }, userId) => {
  if (app_id !== undefined) await writeKey(KEYS.appId, app_id.trim() || null, userId);
  if (app_secret !== undefined) await writeKey(KEYS.appSecret, app_secret.trim() || null, userId);
  cache = null;

  let extended = false;
  if (access_token !== undefined) {
    let token = access_token.trim() || null;
    if (token) {
      const longLived = await meta.extendToken({ app: await metaApp(), token });
      if (longLived && longLived !== token) {
        token = longLived;
        extended = true;
      }
    }
    await writeKey(KEYS.accessToken, token, userId);
    cache = null;
  }
  return { extended };
};

/**
 * Everything the setup page shows: what is configured, and a live check of the token —
 * whose it is, permissions, expiry and how many ad accounts it can read. Secrets never leave the server.
 */
export const metaStatus = async ({ check = true } = {}) => {
  const s = await getMetaSettings({ fresh: true });
  const status = {
    app_id: s.appId,
    has_app_secret: !!s.appSecret,
    has_token: !!s.accessToken,
    source: s.source,
    oauth_ready: !!(s.appId && s.appSecret),
    token: null,
    ad_accounts: null,
    error: null,
  };
  if (!check || !s.accessToken) return status;

  try {
    const info = await meta.inspectToken({ app: { appId: s.appId, appSecret: s.appSecret }, token: s.accessToken });
    const accounts = await meta.listAdAccounts(s.accessToken);
    const daysLeft = info.expires_at ? Math.floor((new Date(info.expires_at) - Date.now()) / 86_400_000) : null;
    status.token = {
      ...info,
      valid: true,
      has_ads_read: info.scopes.includes('ads_read') || info.scopes.includes('ads_management'),
      days_left: daysLeft,
    };
    status.ad_accounts = accounts;
  } catch (err) {
    status.token = { valid: false };
    status.error = err.message;
  }
  return status;
};
