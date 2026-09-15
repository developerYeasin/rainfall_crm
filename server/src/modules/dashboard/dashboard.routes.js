import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/response.js';
import { getScope, guardCycle } from '../../utils/access.js';
import { dashboardService } from './dashboard.service.js';

const router = Router();
const cycleQuerySchema = z.object({ cycle_id: z.coerce.number().int().positive() });

router.get('/overview', asyncHandler(async (req, res) => ok(res, await dashboardService.overview(await getScope(req)))));
router.get(
  '/cycle',
  validate(cycleQuerySchema, 'query'),
  guardCycle((req) => req.validatedQuery.cycle_id),
  asyncHandler(async (req, res) => ok(res, await dashboardService.cycleSummary(req.validatedQuery.cycle_id))),
);

export default router;
