import { Router } from 'express';
import { z } from 'zod';
import { clientController } from './client.controller.js';
import { validate } from '../../middlewares/validate.js';
import { authorize } from '../../middlewares/auth.js';
import { attachScope, guardClient } from '../../utils/access.js';
import { ROLES, WRITE_ROLES } from '../../config/constants.js';
import { createClientSchema, updateClientSchema, listClientsSchema, idParamSchema } from './client.validation.js';

const router = Router();
const guardParam = guardClient((req) => req.params.id);
const staffSchema = z.object({ user_ids: z.array(z.coerce.number().int().positive()).max(50) });

router.get('/', validate(listClientsSchema, 'query'), attachScope, clientController.list);
router.get('/:id', validate(idParamSchema, 'params'), guardParam, clientController.get);
router.post('/', authorize(...WRITE_ROLES), validate(createClientSchema), clientController.create);
router.patch(
  '/:id',
  authorize(...WRITE_ROLES),
  validate(idParamSchema, 'params'),
  guardParam,
  validate(updateClientSchema),
  clientController.update,
);
router.delete('/:id', authorize(ROLES.ADMIN, ROLES.MANAGER), validate(idParamSchema, 'params'), guardParam, clientController.remove);

// Team assignment — who works on this client.
router.get('/:id/staff', validate(idParamSchema, 'params'), guardParam, clientController.staff);
router.put(
  '/:id/staff',
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  validate(idParamSchema, 'params'),
  guardParam,
  validate(staffSchema),
  clientController.setStaff,
);

export default router;
