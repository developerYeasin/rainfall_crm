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
import adAccountRoutes from './modules/ads/ads.routes.js';
import financeRoutes from './modules/finance/finance.routes.js';
import notificationRoutes from './modules/notifications/notification.routes.js';
import agencyTaskRoutes, { teamRouter } from './modules/agencyTasks/agencyTask.routes.js';
import {
  PLATFORMS,
  CONTENT_TYPES,
  CONTENT_STATUS,
  CLIENT_STATUS,
  CYCLE_STATUS,
  ALL_ROLES,
  ORDER_STATUS,
  EXPENSE_CATEGORIES,
  AD_PLATFORMS,
  AGENCY_EXPENSE_CATEGORIES,
  TASK_PRIORITIES,
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
      adPlatforms: AD_PLATFORMS,
      agencyExpenseCategories: AGENCY_EXPENSE_CATEGORIES,
      taskPriorities: TASK_PRIORITIES,
    },
  }),
);

// Open to every login but always scoped: notifications by user, /business/* by client.
router.use('/notifications', notificationRoutes);
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
router.use('/ad-accounts', adAccountRoutes);
router.use('/finance', financeRoutes);
router.use('/agency-tasks', agencyTaskRoutes);
router.use('/team', teamRouter);

export default router;
