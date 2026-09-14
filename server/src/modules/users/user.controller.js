import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, noContent } from '../../utils/response.js';
import { userService } from './user.service.js';
import { logActivity } from '../../utils/activity.js';

export const userController = {
  list: asyncHandler(async (req, res) => {
    const { rows, meta } = await userService.list(req.validatedQuery);
    ok(res, rows, meta);
  }),
  get: asyncHandler(async (req, res) => ok(res, await userService.getById(req.params.id))),
  update: asyncHandler(async (req, res) => {
    const user = await userService.update(req.params.id, req.body);
    await logActivity({ userId: req.user.id, action: 'update', entityType: 'user', entityId: user.id, ip: req.ip });
    ok(res, user);
  }),
  deactivate: asyncHandler(async (req, res) => {
    await userService.deactivate(req.params.id, req.user.id);
    await logActivity({ userId: req.user.id, action: 'deactivate', entityType: 'user', entityId: req.params.id, ip: req.ip });
    noContent(res);
  }),
};
