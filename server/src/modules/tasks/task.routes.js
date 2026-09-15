import { Router } from 'express';
import { taskController } from './task.controller.js';
import { validate } from '../../middlewares/validate.js';
import { authorize } from '../../middlewares/auth.js';
import { guardCycle, guardCycleRow } from '../../utils/access.js';
import { WRITE_ROLES } from '../../config/constants.js';
import { createTaskSchema, updateTaskSchema, listTasksSchema, idParamSchema } from './task.validation.js';

const router = Router();
const guardRow = guardCycleRow('task_compliance');

router.get('/', validate(listTasksSchema, 'query'), guardCycle((req) => req.validatedQuery.cycle_id), taskController.list);
router.get('/:id', validate(idParamSchema, 'params'), guardRow, taskController.get);
router.post(
  '/',
  authorize(...WRITE_ROLES),
  validate(createTaskSchema),
  guardCycle((req) => req.body.cycle_id),
  taskController.create,
);
router.patch(
  '/:id',
  authorize(...WRITE_ROLES),
  validate(idParamSchema, 'params'),
  guardRow,
  validate(updateTaskSchema),
  taskController.update,
);
router.delete('/:id', authorize(...WRITE_ROLES), validate(idParamSchema, 'params'), guardRow, taskController.remove);

export default router;
