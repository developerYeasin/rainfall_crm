import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created, noContent } from '../../utils/response.js';
import { cycleService } from './cycle.service.js';
import { logActivity } from '../../utils/activity.js';

export const cycleController = {
  list: asyncHandler(async (req, res) => {
    const { rows, meta } = await cycleService.list(req.validatedQuery);
    ok(res, rows, meta);
  }),
  get: asyncHandler(async (req, res) => ok(res, await cycleService.getById(req.params.id))),
  projection: asyncHandler(async (req, res) => ok(res, await cycleService.projection(req.params.id))),
  create: asyncHandler(async (req, res) => {
    const cycle = await cycleService.create(req.body, req.user.id);
    await logActivity({ userId: req.user.id, action: 'create', entityType: 'cycle', entityId: cycle.id, ip: req.ip });
    created(res, cycle);
  }),
  update: asyncHandler(async (req, res) => {
    const cycle = await cycleService.update(req.params.id, req.body);
    await logActivity({ userId: req.user.id, action: 'update', entityType: 'cycle', entityId: cycle.id, ip: req.ip });
    ok(res, cycle);
  }),
  updateWeek: asyncHandler(async (req, res) =>
    ok(res, await cycleService.updateWeek(req.params.id, req.params.weekNo, req.body)),
  ),
  remove: asyncHandler(async (req, res) => {
    await cycleService.remove(req.params.id);
    await logActivity({ userId: req.user.id, action: 'delete', entityType: 'cycle', entityId: req.params.id, ip: req.ip });
    noContent(res);
  }),
};
