import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created, noContent } from '../../utils/response.js';
import { clientService } from './client.service.js';
import { logActivity } from '../../utils/activity.js';

export const clientController = {
  list: asyncHandler(async (req, res) => {
    const { rows, meta } = await clientService.list(req.validatedQuery);
    ok(res, rows, meta);
  }),
  get: asyncHandler(async (req, res) => ok(res, await clientService.getWithCycles(req.params.id))),
  create: asyncHandler(async (req, res) => {
    const client = await clientService.create(req.body, req.user.id);
    await logActivity({ userId: req.user.id, action: 'create', entityType: 'client', entityId: client.id, ip: req.ip });
    created(res, client);
  }),
  update: asyncHandler(async (req, res) => {
    const client = await clientService.update(req.params.id, req.body);
    await logActivity({ userId: req.user.id, action: 'update', entityType: 'client', entityId: client.id, ip: req.ip });
    ok(res, client);
  }),
  remove: asyncHandler(async (req, res) => {
    await clientService.remove(req.params.id);
    await logActivity({ userId: req.user.id, action: 'delete', entityType: 'client', entityId: req.params.id, ip: req.ip });
    noContent(res);
  }),
};
