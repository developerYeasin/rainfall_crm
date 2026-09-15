import { Router } from 'express';
import { z } from 'zod';
import { performanceController } from './performance.controller.js';
import { validate } from '../../middlewares/validate.js';
import { authorize } from '../../middlewares/auth.js';
import { guardCycle, guardCycleRow } from '../../utils/access.js';
import { WRITE_ROLES } from '../../config/constants.js';
import {
  createEntrySchema,
  updateEntrySchema,
  listEntriesSchema,
  bulkEntriesSchema,
  idParamSchema,
} from './performance.validation.js';

const router = Router();
const cycleQuerySchema = z.object({ cycle_id: z.coerce.number().int().positive() });
const guardQuery = guardCycle((req) => req.validatedQuery.cycle_id);
const guardBody = guardCycle((req) => req.body.cycle_id);
const guardRow = guardCycleRow('performance_entries');

router.get('/', validate(listEntriesSchema, 'query'), guardQuery, performanceController.list);
router.get('/breakdown', validate(cycleQuerySchema, 'query'), guardQuery, performanceController.breakdown);
router.get('/:id', validate(idParamSchema, 'params'), guardRow, performanceController.get);
router.post('/', authorize(...WRITE_ROLES), validate(createEntrySchema), guardBody, performanceController.create);
router.post('/bulk', authorize(...WRITE_ROLES), validate(bulkEntriesSchema), guardBody, performanceController.bulk);
router.patch(
  '/:id',
  authorize(...WRITE_ROLES),
  validate(idParamSchema, 'params'),
  guardRow,
  validate(updateEntrySchema),
  performanceController.update,
);
router.delete('/:id', authorize(...WRITE_ROLES), validate(idParamSchema, 'params'), guardRow, performanceController.remove);

export default router;
