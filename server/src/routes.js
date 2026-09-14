import { Router } from 'express';
import { authenticate, staffOnly } from './middlewares/auth.js';
import businessRoutes from './modules/business/business.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/user.routes.js';
import clientRoutes from './modules/clients/client.routes.js';
import cycleRoutes from './modules/cycles/cycle.routes.js';
import performanceRoutes from './modules/performance/performance.routes.js';
import controlRoutes from './modules/control/control.routes.js';
import taskRoutes from './modules/tasks/task.routes.js';
import contentRoutes from './modules/content/content.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import activityRoutes from './modules/activity/activity.routes.js';
import {
  PLATFORMS,
  CONTENT_TYPES,
  CONTENT_STATUS,
  CLIENT_STATUS,
  CYCLE_STATUS,
  ALL_ROLES,
  ORDER_STATUS,
  EXPENSE_CATEGORIES,
} from './config/constants.js';

const router = Router();

router.use('/auth', authRoutes);

// Everything below requires a valid access token.
router.use(authenticate);

router.get('/meta', (req, res) =>
  res.json({
    success: true,
    data: {
      platforms: PLATFORMS,
      contentTypes: CONTENT_TYPES,
      contentStatus: CONTENT_STATUS,
      clientStatus: CLIENT_STATUS,
      cycleStatus: CYCLE_STATUS,
      roles: ALL_ROLES,
      orderStatus: ORDER_STATUS,
      expenseCategories: EXPENSE_CATEGORIES,
    },
  }),
);

// Client logins are scoped to their own business data; everything after this is staff-only.
router.use('/business', businessRoutes);
router.use(staffOnly);

router.use('/users', userRoutes);
router.use('/clients', clientRoutes);
router.use('/cycles', cycleRoutes);
router.use('/performance', performanceRoutes);
router.use('/control', controlRoutes);
router.use('/tasks', taskRoutes);
router.use('/content', contentRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/activity', activityRoutes);

export default router;
