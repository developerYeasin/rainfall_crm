import { Router } from 'express';
import { z } from 'zod';
import { performanceController } from './performance.controller.js';
import { validate } from '../../middlewares/validate.js';
import { authorize } from '../../middlewares/auth.js';
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

router.get('/', validate(listEntriesSchema, 'query'), performanceController.list);
router.get('/breakdown', validate(cycleQuerySchema, 'query'), performanceController.breakdown);
router.get('/:id', validate(idParamSchema, 'params'), performanceController.get);
router.post('/', authorize(...WRITE_ROLES), validate(createEntrySchema), performanceController.create);
router.post('/bulk', authorize(...WRITE_ROLES), validate(bulkEntriesSchema), performanceController.bulk);
router.patch(
  '/:id',
  authorize(...WRITE_ROLES),
  validate(idParamSchema, 'params'),
  validate(updateEntrySchema),
  performanceController.update,
);
router.delete('/:id', authorize(...WRITE_ROLES), validate(idParamSchema, 'params'), performanceController.remove);

export default router;
