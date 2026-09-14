import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/response.js';
import { dashboardService } from './dashboard.service.js';

const router = Router();
const cycleQuerySchema = z.object({ cycle_id: z.coerce.number().int().positive() });

router.get('/overview', asyncHandler(async (req, res) => ok(res, await dashboardService.overview())));
router.get(
  '/cycle',
  validate(cycleQuerySchema, 'query'),
  asyncHandler(async (req, res) => ok(res, await dashboardService.cycleSummary(req.validatedQuery.cycle_id))),
);

export default router;
