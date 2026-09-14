import { Router } from 'express';
import { cycleController } from './cycle.controller.js';
import { validate } from '../../middlewares/validate.js';
import { authorize } from '../../middlewares/auth.js';
import { ROLES, WRITE_ROLES } from '../../config/constants.js';
import {
  createCycleSchema,
  updateCycleSchema,
  listCyclesSchema,
  updateWeekSchema,
  idParamSchema,
  weekParamSchema,
} from './cycle.validation.js';

const router = Router();

router.get('/', validate(listCyclesSchema, 'query'), cycleController.list);
router.get('/:id', validate(idParamSchema, 'params'), cycleController.get);
router.get('/:id/projection', validate(idParamSchema, 'params'), cycleController.projection);
router.post('/', authorize(...WRITE_ROLES), validate(createCycleSchema), cycleController.create);
router.patch(
  '/:id',
  authorize(...WRITE_ROLES),
  validate(idParamSchema, 'params'),
  validate(updateCycleSchema),
  cycleController.update,
);
router.patch(
  '/:id/weeks/:weekNo',
  authorize(...WRITE_ROLES),
  validate(weekParamSchema, 'params'),
  validate(updateWeekSchema),
  cycleController.updateWeek,
);
router.delete('/:id', authorize(ROLES.ADMIN, ROLES.MANAGER), validate(idParamSchema, 'params'), cycleController.remove);

export default router;
