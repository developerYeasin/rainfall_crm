import { Router } from 'express';
import { authController } from './auth.controller.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { authLimiter } from '../../middlewares/rateLimit.js';
import { ROLES } from '../../config/constants.js';
import { loginSchema, registerSchema, refreshSchema, changePasswordSchema } from './auth.validation.js';

const router = Router();

router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/refresh', authLimiter, validate(refreshSchema), authController.refresh);
router.post('/logout', authController.logout);
router.post('/register', authenticate, authorize(ROLES.ADMIN), validate(registerSchema), authController.register);
router.get('/me', authenticate, authController.me);
router.patch('/password', authenticate, validate(changePasswordSchema), authController.changePassword);

export default router;
