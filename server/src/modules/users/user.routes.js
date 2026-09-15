import { Router } from 'express';
import { userController } from './user.controller.js';
import { validate } from '../../middlewares/validate.js';
import { authorize } from '../../middlewares/auth.js';
import { ROLES } from '../../config/constants.js';
import { listUsersSchema, updateUserSchema, idParamSchema } from './user.validation.js';

const router = Router();

router.get('/', authorize(ROLES.ADMIN, ROLES.MANAGER), validate(listUsersSchema, 'query'), userController.list);
router.get('/:id', authorize(ROLES.ADMIN, ROLES.MANAGER), validate(idParamSchema, 'params'), userController.get);
router.patch('/:id', authorize(ROLES.ADMIN), validate(idParamSchema, 'params'), validate(updateUserSchema), userController.update);
router.delete('/:id', authorize(ROLES.ADMIN), validate(idParamSchema, 'params'), userController.deactivate);
router.post('/:id/reset-password', authorize(ROLES.ADMIN, ROLES.MANAGER), validate(idParamSchema, 'params'), userController.resetPassword);

export default router;
