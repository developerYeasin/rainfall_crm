import { Router } from 'express';
import { z } from 'zod';
import { clientController } from './client.controller.js';
import { validate } from '../../middlewares/validate.js';
import { authorize } from '../../middlewares/auth.js';
import { attachScope, guardClient } from '../../utils/access.js';
import { ROLES, WRITE_ROLES } from '../../config/constants.js';
import {
  createClientWithLoginSchema,
  clientLoginSchema,
  updateClientSchema,
  listClientsSchema,
  idParamSchema,
} from './client.validation.js';

const router = Router();
const guardParam = guardClient((req) => req.params.id);
const staffSchema = z.object({ user_ids: z.array(z.coerce.number().int().positive()).max(50) });

router.get('/', validate(listClientsSchema, 'query'), attachScope, clientController.list);
router.get('/:id', validate(idParamSchema, 'params'), guardParam, clientController.get);
// Opening a client also issues its login, so only admins and managers may do it.
router.post('/', authorize(ROLES.ADMIN, ROLES.MANAGER), validate(createClientWithLoginSchema), clientController.create);
router.get('/:id/logins', authorize(ROLES.ADMIN, ROLES.MANAGER), validate(idParamSchema, 'params'), guardParam, clientController.logins);
router.post(
  '/:id/login',
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  validate(idParamSchema, 'params'),
  guardParam,
  validate(clientLoginSchema),
  clientController.issueLogin,
);
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
