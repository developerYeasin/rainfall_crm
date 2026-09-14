import { Router } from 'express';
import { contentController } from './content.controller.js';
import { validate } from '../../middlewares/validate.js';
import { authorize } from '../../middlewares/auth.js';
import { ROLES, WRITE_ROLES } from '../../config/constants.js';
import { createContentSchema, updateContentSchema, listContentSchema, idParamSchema } from './content.validation.js';

const router = Router();
const CONTENT_WRITERS = [...WRITE_ROLES, ROLES.DESIGNER];

router.get('/', validate(listContentSchema, 'query'), contentController.list);
router.get('/:id', validate(idParamSchema, 'params'), contentController.get);
router.post('/', authorize(...CONTENT_WRITERS), validate(createContentSchema), contentController.create);
router.patch(
  '/:id',
  authorize(...CONTENT_WRITERS),
  validate(idParamSchema, 'params'),
  validate(updateContentSchema),
  contentController.update,
);
router.delete('/:id', authorize(...CONTENT_WRITERS), validate(idParamSchema, 'params'), contentController.remove);

export default router;
