import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created, noContent } from '../../utils/response.js';
import { clientService } from './client.service.js';
import { logActivity } from '../../utils/activity.js';
import { hasGlobalAccess } from '../../utils/access.js';
import { adminIds, notifyUsers } from '../../utils/notify.js';

export const clientController = {
  list: asyncHandler(async (req, res) => {
    const { rows, meta } = await clientService.list(req.validatedQuery);
    ok(res, rows, meta);
  }),
  get: asyncHandler(async (req, res) => ok(res, await clientService.getWithCycles(req.params.id))),
  create: asyncHandler(async (req, res) => {
    // Non-admins are assigned to what they create, otherwise it would vanish from their own scope.
    const client = await clientService.create(req.body, req.user.id, { assignCreator: !hasGlobalAccess(req.user) });
    await logActivity({ userId: req.user.id, action: 'create', entityType: 'client', entityId: client.id, ip: req.ip });
    await notifyUsers(await adminIds(), {
      type: 'client_onboarded',
      data: { client: client.name, by: req.user.name },
      link: `/clients/${client.id}`,
      clientId: client.id,
    });
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
  staff: asyncHandler(async (req, res) => ok(res, await clientService.staff(req.params.id))),
  setStaff: asyncHandler(async (req, res) => {
    const staff = await clientService.setStaff(req.params.id, req.body.user_ids);
    await logActivity({
      userId: req.user.id,
      action: 'assign_staff',
      entityType: 'client',
      entityId: req.params.id,
      meta: { user_ids: req.body.user_ids },
      ip: req.ip,
    });
    ok(res, staff);
  }),
};
