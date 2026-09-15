import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created } from '../../utils/response.js';
import { authService } from './auth.service.js';
import { logActivity } from '../../utils/activity.js';
import { ApiError } from '../../utils/ApiError.js';

export const authController = {
  register: asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin' && req.body.role === 'admin') throw ApiError.forbidden('ম্যানেজার অ্যাডমিন অ্যাকাউন্ট তৈরি করতে পারে না');
    const result = await authService.register(req.body);
    await logActivity({ userId: req.user?.id, action: 'create', entityType: 'user', entityId: result.user.id, ip: req.ip });
    created(res, result);
  }),

  login: asyncHandler(async (req, res) => {
    const result = await authService.login(req.body);
    await logActivity({ userId: result.user.id, action: 'login', entityType: 'auth', ip: req.ip });
    ok(res, result);
  }),

  refresh: asyncHandler(async (req, res) => ok(res, await authService.refresh(req.body.refreshToken))),

  logout: asyncHandler(async (req, res) => {
    await authService.logout(req.body?.refreshToken);
    await logActivity({ userId: req.user?.id, action: 'logout', entityType: 'auth', ip: req.ip });
    ok(res, { message: 'লগআউট সম্পন্ন' });
  }),

  me: asyncHandler(async (req, res) => ok(res, await authService.getById(req.user.id))),

  changePassword: asyncHandler(async (req, res) => {
    await authService.changePassword(req.user.id, req.body);
    ok(res, { message: 'পাসওয়ার্ড পরিবর্তন হয়েছে' });
  }),
};
