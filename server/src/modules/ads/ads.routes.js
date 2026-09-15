import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.js';
import { authorize } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created, noContent } from '../../utils/response.js';
import { logActivity } from '../../utils/activity.js';
import { ApiError } from '../../utils/ApiError.js';
import { getScope, guardClient } from '../../utils/access.js';
import { ROLES, WRITE_ROLES, AD_PLATFORMS } from '../../config/constants.js';
import { adsService } from './ads.service.js';
import { syncAccount } from './ads.sync.js';

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

export default router;
