import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created, noContent } from '../../utils/response.js';
import { taskService } from './task.service.js';
import { logActivity } from '../../utils/activity.js';

export const taskController = {
  list: asyncHandler(async (req, res) => {
    const { rows, meta } = await taskService.list(req.validatedQuery);
    ok(res, rows, meta);
  }),
  get: asyncHandler(async (req, res) => ok(res, await taskService.getById(req.params.id))),
  create: asyncHandler(async (req, res) => {
    const task = await taskService.create(req.body);
    await logActivity({ userId: req.user.id, action: 'create', entityType: 'task', entityId: task.id, ip: req.ip });
    created(res, task);
  }),
  update: asyncHandler(async (req, res) => ok(res, await taskService.update(req.params.id, req.body))),
  remove: asyncHandler(async (req, res) => {
    await taskService.remove(req.params.id);
    noContent(res);
  }),
};
