import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/response.js';
import { controlService } from './control.service.js';

const router = Router();
const cycleQuerySchema = z.object({ cycle_id: z.coerce.number().int().positive() });

router.get(
  '/',
  validate(cycleQuerySchema, 'query'),
  asyncHandler(async (req, res) => ok(res, await controlService.inspection(req.validatedQuery.cycle_id))),
);

export default router;
