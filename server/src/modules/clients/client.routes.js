import { Router } from 'express';
import { clientController } from './client.controller.js';
import { validate } from '../../middlewares/validate.js';
import { authorize } from '../../middlewares/auth.js';
import { ROLES, WRITE_ROLES } from '../../config/constants.js';
import { createClientSchema, updateClientSchema, listClientsSchema, idParamSchema } from './client.validation.js';

const router = Router();

router.get('/', validate(listClientsSchema, 'query'), clientController.list);
router.get('/:id', validate(idParamSchema, 'params'), clientController.get);
router.post('/', authorize(...WRITE_ROLES), validate(createClientSchema), clientController.create);
router.patch(
  '/:id',
  authorize(...WRITE_ROLES),
  validate(idParamSchema, 'params'),
  validate(updateClientSchema),
  clientController.update,
);
router.delete('/:id', authorize(ROLES.ADMIN, ROLES.MANAGER), validate(idParamSchema, 'params'), clientController.remove);

export default router;
