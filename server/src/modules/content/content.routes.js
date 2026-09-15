import { Router } from 'express';
import { contentController } from './content.controller.js';
import { validate } from '../../middlewares/validate.js';
import { authorize } from '../../middlewares/auth.js';
import { guardCycle, guardCycleRow } from '../../utils/access.js';
import { ROLES, WRITE_ROLES } from '../../config/constants.js';
import { createContentSchema, updateContentSchema, listContentSchema, idParamSchema } from './content.validation.js';

const router = Router();
const CONTENT_WRITERS = [...WRITE_ROLES, ROLES.DESIGNER];
const guardRow = guardCycleRow('content_calendar');

router.get('/', validate(listContentSchema, 'query'), guardCycle((req) => req.validatedQuery.cycle_id), contentController.list);
router.get('/:id', validate(idParamSchema, 'params'), guardRow, contentController.get);
router.post(
  '/',
  authorize(...CONTENT_WRITERS),
  validate(createContentSchema),
  guardCycle((req) => req.body.cycle_id),
  contentController.create,
);
router.patch(
  '/:id',
  authorize(...CONTENT_WRITERS),
  validate(idParamSchema, 'params'),
  guardRow,
  validate(updateContentSchema),
  contentController.update,
);
router.delete('/:id', authorize(...CONTENT_WRITERS), validate(idParamSchema, 'params'), guardRow, contentController.remove);

export default router;
