import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.js';
import { authorize } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/response.js';
import { logActivity } from '../../utils/activity.js';
import { ROLES } from '../../config/constants.js';
import { config } from '../../config/index.js';
import { metaStatus, saveMetaSettings } from './meta.settings.js';
import { metaRedirectUri } from '../ads/ads.routes.js';

/** Admin-only integration settings (Meta app + access token). */
const router = Router();
router.use(authorize(ROLES.ADMIN));

const withSetupInfo = async (req, status) => ({
  ...status,
  redirect_uri: metaRedirectUri(req),
  timezone: config.jobs.timezone,
  daily_report_time: config.jobs.dailyReportTime,
  sync_every_minutes: Math.round(Math.max(config.jobs.adSyncHours, 0.25) * 60),
});

/** `?check=false` skips the live call to Meta (fast page load); the page runs the check separately. */
router.get(
  '/meta',
  validate(z.object({ check: z.enum(['true', 'false']).default('true') }), 'query'),
  asyncHandler(async (req, res) => ok(res, await withSetupInfo(req, await metaStatus({ check: req.validatedQuery.check === 'true' })))),
);

const field = z.string().max(1000).optional();

router.put(
  '/meta',
  validate(
    z.object({
      app_id: z.string().trim().regex(/^\d*$/, 'App ID শুধু সংখ্যা').max(40).optional(),
      app_secret: field,
      access_token: field,
    }),
  ),
  asyncHandler(async (req, res) => {
    const { extended } = await saveMetaSettings(req.body, req.user.id);
    await logActivity({
      userId: req.user.id,
      action: 'update',
      entityType: 'meta_settings',
      entityId: null,
      // Which fields changed — never the values.
      meta: { fields: Object.keys(req.body), token_extended: extended },
      ip: req.ip,
    });
    ok(res, { ...(await withSetupInfo(req, await metaStatus())), token_extended: extended });
  }),
);

export default router;
