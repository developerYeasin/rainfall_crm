import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created, noContent } from '../../utils/response.js';
import { performanceService } from './performance.service.js';
import { logActivity } from '../../utils/activity.js';

export const performanceController = {
  list: asyncHandler(async (req, res) => {
    const { rows, meta } = await performanceService.list(req.validatedQuery);
    ok(res, rows, meta);
  }),
  breakdown: asyncHandler(async (req, res) =>
    ok(res, await performanceService.breakdown(req.validatedQuery.cycle_id)),
  ),
  get: asyncHandler(async (req, res) => ok(res, await performanceService.getById(req.params.id))),
  create: asyncHandler(async (req, res) => {
    const entry = await performanceService.create(req.body, req.user.id);
    await logActivity({ userId: req.user.id, action: 'create', entityType: 'performance', entityId: entry.id, ip: req.ip });
    created(res, entry);
  }),
  bulk: asyncHandler(async (req, res) => created(res, await performanceService.createMany(req.body, req.user.id))),
  update: asyncHandler(async (req, res) => {
    const entry = await performanceService.update(req.params.id, req.body);
    await logActivity({ userId: req.user.id, action: 'update', entityType: 'performance', entityId: entry.id, ip: req.ip });
    ok(res, entry);
  }),
  remove: asyncHandler(async (req, res) => {
    await performanceService.remove(req.params.id);
    await logActivity({ userId: req.user.id, action: 'delete', entityType: 'performance', entityId: req.params.id, ip: req.ip });
    noContent(res);
  }),
};
