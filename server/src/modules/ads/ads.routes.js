import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.js';
import { authorize } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created, noContent } from '../../utils/response.js';
import { query, queryOne } from '../../db/pool.js';
import { logActivity } from '../../utils/activity.js';
import { ApiError } from '../../utils/ApiError.js';
import { getScope, guardClient } from '../../utils/access.js';
import { ROLES, WRITE_ROLES, AD_PLATFORMS } from '../../config/constants.js';
import { adsService } from './ads.service.js';
import jwt from 'jsonwebtoken';
import { syncAccount } from './ads.sync.js';
import * as meta from './meta.client.js';
import { config } from '../../config/index.js';
import { encryptSecret, decryptSecret } from '../../utils/crypto.js';
import { agencyMetaToken, metaApp, oauthConfigured } from '../settings/meta.settings.js';

/** Agency-side ad account management (staff only). */
const router = Router();
const manage = authorize(ROLES.ADMIN, ROLES.MANAGER);
const idParam = z.object({ id: z.coerce.number().int().positive() });

const accountSchema = z.object({
  client_id: z.coerce.number().int().positive(),
  platform: z.enum(AD_PLATFORMS).default('meta'),
  external_id: z.string().trim().min(3, 'অ্যাড অ্যাকাউন্ট আইডি দিন').max(64),
  name: z.string().trim().min(1).max(160),
  currency: z.string().trim().max(8).optional(),
  access_token: z.string().trim().max(1000).optional().or(z.literal('')),
  result_action: z.string().trim().max(80).nullable().optional(),
  daily_budget: z.coerce.number().min(0).nullable().optional(),
  assigned_user_id: z.coerce.number().int().positive().nullable().optional(),
  is_active: z.boolean().optional(),
});
const updateSchema = accountSchema.partial().extend({ clear_token: z.boolean().optional() });
const listSchema = z.object({
  client_id: z.coerce.number().int().positive().optional(),
  platform: z.enum(AD_PLATFORMS).optional(),
  assigned_user_id: z.coerce.number().int().positive().optional(),
});

const audit = (req, action, id, meta) =>
  logActivity({ userId: req.user.id, action, entityType: 'ad_account', entityId: id, meta, ip: req.ip });

router.get(
  '/',
  validate(listSchema, 'query'),
  asyncHandler(async (req, res) => ok(res, await adsService.listAccounts(await getScope(req), req.validatedQuery))),
);

router.post(
  '/',
  manage,
  validate(accountSchema),
  guardClient((req) => req.body.client_id),
  asyncHandler(async (req, res) => {
    const account = await adsService.createAccount(req.body, req.user.id);
    await audit(req, 'create', account.id, { client_id: account.client_id, platform: account.platform });
    created(res, account);
  }),
);

router.patch(
  '/:id',
  manage,
  validate(idParam, 'params'),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const account = await adsService.updateAccount(req.params.id, req.body, await getScope(req));
    // Never log the token itself.
    const { access_token, ...changes } = req.body;
    await audit(req, 'update', account.id, { changes, token_changed: !!access_token || !!req.body.clear_token });
    ok(res, account);
  }),
);

router.delete(
  '/:id',
  manage,
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    await adsService.removeAccount(req.params.id, await getScope(req));
    await audit(req, 'delete', req.params.id);
    noContent(res);
  }),
);

router.post(
  '/:id/sync',
  authorize(...WRITE_ROLES),
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    await adsService.getAccount(req.params.id, await getScope(req));
    try {
      const result = await syncAccount(req.params.id);
      ok(res, { ...result, account: await adsService.getAccount(req.params.id) });
    } catch (err) {
      throw ApiError.badRequest(err.message);
    }
  }),
);

// ---------------------------------------------------------------- Facebook (Meta) direct connect
/**
 * Flow: "Connect with Facebook" → Facebook login → /integrations/meta/callback stores the long-lived
 * token in a short-lived signed session → the page lists the user's ad accounts → picked ones are
 * imported with that token and synced straight away. A pasted system-user token works the same way,
 * and so does the agency token saved on the Meta setup page (`use_saved`).
 */
export const metaRedirectUri = (req) =>
  `${(config.apiPublicUrl || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '')}/api/v1/integrations/meta/callback`;

const sessionToken = (token, extra = {}) =>
  jwt.sign({ purpose: 'meta_session', tok: encryptSecret(token), ...extra }, config.jwt.accessSecret, { expiresIn: '30m' });

/**
 * The Meta token behind a request: the saved agency token, a connect session or a pasted token.
 * `saved` accounts store no token of their own, so renewing the agency token renews them all.
 */
const metaTokenFrom = async (body) => {
  if (body.use_saved) {
    const token = await agencyMetaToken();
    if (!token) throw ApiError.badRequest('Meta সেটআপে এখনো কোনো অ্যাক্সেস টোকেন সেভ করা হয়নি');
    return { token, saved: true };
  }
  if (body.access_token) return { token: body.access_token, saved: false };
  if (!body.session) throw ApiError.badRequest('Facebook কানেক্ট করুন বা অ্যাক্সেস টোকেন দিন');
  try {
    const payload = jwt.verify(body.session, config.jwt.accessSecret);
    if (payload.purpose !== 'meta_session') throw new Error('bad purpose');
    return { token: decryptSecret(payload.tok), saved: false };
  } catch {
    throw ApiError.badRequest('Facebook সেশনের মেয়াদ শেষ — আবার কানেক্ট করুন');
  }
};

const tokenSource = {
  use_saved: z.boolean().optional(),
  session: z.string().optional(),
  access_token: z.string().trim().max(1000).optional(),
};

/** Where Facebook should send the browser back: the web app the admin started from, if it is one of ours. */
const appOriginFor = (req) => {
  const origin = req.get('origin');
  return origin && config.clientOrigins.includes(origin) ? origin : config.jobs.appUrl;
};

router.get(
  '/meta/connect-url',
  manage,
  validate(z.object({ client_id: z.coerce.number().int().positive().optional() }), 'query'),
  asyncHandler(async (req, res) => {
    if (!(await oauthConfigured())) throw ApiError.badRequest('Meta সেটআপ পেজে App ID ও App Secret দিন');
    const redirectUri = metaRedirectUri(req);
    const state = jwt.sign(
      { purpose: 'meta_oauth', uid: req.user.id, cid: req.validatedQuery.client_id ?? null, ru: redirectUri, app: appOriginFor(req) },
      config.jwt.accessSecret,
      { expiresIn: '15m' },
    );
    ok(res, { url: meta.oauthDialogUrl({ app: await metaApp(), redirectUri, state }) });
  }),
);

router.post(
  '/meta/discover',
  manage,
  validate(z.object(tokenSource)),
  asyncHandler(async (req, res) => {
    let accounts;
    try {
      accounts = await meta.listAdAccounts((await metaTokenFrom(req.body)).token);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw ApiError.badRequest(err.message);
    }
    const existing = await query("SELECT external_id, client_id FROM ad_accounts WHERE platform = 'meta'");
    const linked = new Map(existing.map((e) => [String(e.external_id), e.client_id]));
    ok(res, accounts.map((a) => ({ ...a, linked_client_id: linked.get(String(a.external_id)) ?? null })));
  }),
);

router.post(
  '/meta/import',
  manage,
  validate(
    z.object({
      ...tokenSource,
      client_id: z.coerce.number().int().positive(),
      assigned_user_id: z.coerce.number().int().positive().nullable().optional(),
      accounts: z
        .array(z.object({ external_id: z.string().trim().min(3).max(64), name: z.string().trim().min(1).max(160), currency: z.string().max(8).optional() }))
        .min(1, 'অন্তত একটি অ্যাড অ্যাকাউন্ট বেছে নিন')
        .max(50),
    }),
  ),
  guardClient((req) => req.body.client_id),
  asyncHandler(async (req, res) => {
    const { token, saved } = await metaTokenFrom(req.body);
    // Accounts found through the saved agency token keep no copy of it.
    const tokenFields = saved ? { clear_token: true } : { access_token: token };
    const imported = [];
    for (const a of req.body.accounts) {
      const found = await queryOne("SELECT id FROM ad_accounts WHERE platform = 'meta' AND external_id = ?", [meta.normaliseAccountId(a.external_id)]);
      if (found) {
        // Re-connecting an account under another client moves it (and its history) there.
        await query('UPDATE ad_accounts SET client_id = ? WHERE id = ?', [req.body.client_id, found.id]);
        await query('UPDATE ad_insights SET client_id = ? WHERE ad_account_id = ?', [req.body.client_id, found.id]);
      }
      const account = found
        ? await adsService.updateAccount(found.id, { ...tokenFields, is_active: true, name: a.name })
        : await adsService.createAccount(
            { client_id: req.body.client_id, platform: 'meta', external_id: a.external_id, name: a.name, currency: a.currency, access_token: saved ? null : token, assigned_user_id: req.body.assigned_user_id },
            req.user.id,
          );
      imported.push(account);
      await audit(req, found ? 'reconnect' : 'create', account.id, { client_id: req.body.client_id, platform: 'meta', via: saved ? 'agency_token' : 'facebook_connect' });
    }
    // First sync runs in the background (a 30-day backfill can take a while); the page polls the status.
    for (const a of imported) syncAccount(a.id).catch((err) => console.error(`[ads-sync] account ${a.id}: ${err.message}`));
    created(res, imported);
  }),
);

export default router;

/** Public: Facebook redirects the browser here, so it runs without our access token and trusts only the signed state. */
export const integrationsRouter = Router();
integrationsRouter.get(
  '/meta/callback',
  asyncHandler(async (req, res) => {
    let state = null;
    try {
      state = jwt.verify(String(req.query.state || ''), config.jwt.accessSecret);
      if (state.purpose !== 'meta_oauth') throw new Error('bad purpose');
    } catch {
      state = null;
    }
    // The origin inside the signed state was checked against CLIENT_ORIGIN when it was issued.
    const appUrl = (state?.app || config.jobs.appUrl).replace(/\/$/, '');
    const back = (params) => res.redirect(`${appUrl}/ad-accounts?${new URLSearchParams(params)}`);
    if (!state) return back({ meta_error: 'Facebook সংযোগের মেয়াদ শেষ — আবার চেষ্টা করুন' });
    if (req.query.error || !req.query.code) {
      return back({ meta_error: String(req.query.error_description || req.query.error || 'Facebook অনুমতি দেওয়া হয়নি') });
    }
    try {
      const token = await meta.exchangeCode({ app: await metaApp(), code: String(req.query.code), redirectUri: state.ru });
      return back({ meta_session: sessionToken(token), ...(state.cid ? { client_id: state.cid } : {}) });
    } catch (err) {
      return back({ meta_error: err.message });
    }
  }),
);
