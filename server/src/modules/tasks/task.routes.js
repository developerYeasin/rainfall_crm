import { Router } from 'express';
import { taskController } from './task.controller.js';
import { validate } from '../../middlewares/validate.js';
import { authorize } from '../../middlewares/auth.js';
import { WRITE_ROLES } from '../../config/constants.js';
import { createTaskSchema, updateTaskSchema, listTasksSchema, idParamSchema } from './task.validation.js';

const router = Router();

router.get('/', validate(listTasksSchema, 'query'), taskController.list);
router.get('/:id', validate(idParamSchema, 'params'), taskController.get);
router.post('/', authorize(...WRITE_ROLES), validate(createTaskSchema), taskController.create);
router.patch(
  '/:id',
  authorize(...WRITE_ROLES),
  validate(idParamSchema, 'params'),
  validate(updateTaskSchema),
  taskController.update,
);
router.delete('/:id', authorize(...WRITE_ROLES), validate(idParamSchema, 'params'), taskController.remove);

export default router;
