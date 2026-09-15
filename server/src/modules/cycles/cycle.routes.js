import { Router } from 'express';
import { cycleController } from './cycle.controller.js';
import { validate } from '../../middlewares/validate.js';
import { authorize } from '../../middlewares/auth.js';
import { attachScope, guardClient, guardCycle } from '../../utils/access.js';
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
const guardParam = guardCycle((req) => req.params.id);

router.get('/', validate(listCyclesSchema, 'query'), attachScope, cycleController.list);
router.get('/:id', validate(idParamSchema, 'params'), guardParam, cycleController.get);
router.get('/:id/projection', validate(idParamSchema, 'params'), guardParam, cycleController.projection);
router.post(
  '/',
  authorize(...WRITE_ROLES),
  validate(createCycleSchema),
  guardClient((req) => req.body.client_id),
  cycleController.create,
);
router.patch(
  '/:id',
  authorize(...WRITE_ROLES),
  validate(idParamSchema, 'params'),
  guardParam,
  validate(updateCycleSchema),
  cycleController.update,
);
router.patch(
  '/:id/weeks/:weekNo',
  authorize(...WRITE_ROLES),
  validate(weekParamSchema, 'params'),
  guardParam,
  validate(updateWeekSchema),
  cycleController.updateWeek,
);
router.delete('/:id', authorize(ROLES.ADMIN, ROLES.MANAGER), validate(idParamSchema, 'params'), guardParam, cycleController.remove);

export default router;
