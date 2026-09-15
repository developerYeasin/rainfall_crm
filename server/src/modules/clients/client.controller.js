import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created, noContent } from '../../utils/response.js';
import { clientService } from './client.service.js';
import { logActivity } from '../../utils/activity.js';
import { hasGlobalAccess } from '../../utils/access.js';
import { adminIds, notifyUsers } from '../../utils/notify.js';
import { ApiError } from '../../utils/ApiError.js';
import { query, queryOne } from '../../db/pool.js';
import { authService } from '../auth/auth.service.js';

export const clientController = {
  list: asyncHandler(async (req, res) => {
    const { rows, meta } = await clientService.list(req.validatedQuery);
    ok(res, rows, meta);
  }),
  get: asyncHandler(async (req, res) => ok(res, await clientService.getWithCycles(req.params.id))),
  create: asyncHandler(async (req, res) => {
    const { create_login: createLogin, login_email: loginEmail, ...payload } = req.body;
    const email = loginEmail || payload.email;
    if (createLogin) {
      if (!email) throw ApiError.badRequest('লগইন তৈরির জন্য ক্লায়েন্টের ইমেইল দিন');
      if (await queryOne('SELECT id FROM users WHERE email = ?', [email])) throw ApiError.conflict('এই ইমেইলে অ্যাকাউন্ট আছে');
    }
    // Non-admins are assigned to what they create, otherwise it would vanish from their own scope.
    const client = await clientService.create(payload, req.user.id, { assignCreator: !hasGlobalAccess(req.user) });
    const login = createLogin
      ? await authService.register({ name: payload.contact_person || client.name, email, role: 'client', client_id: client.id, phone: payload.phone })
      : null;
    await logActivity({ userId: req.user.id, action: 'create', entityType: 'client', entityId: client.id, ip: req.ip });
    await notifyUsers(await adminIds(), {
      type: 'client_onboarded',
      data: { client: client.name, by: req.user.name },
      link: `/clients/${client.id}`,
      clientId: client.id,
    });
    created(res, { ...client, credentials: login?.credentials ?? null });
  }),
  logins: asyncHandler(async (req, res) =>
    ok(
      res,
      await query("SELECT id, name, email, is_active, last_login_at FROM users WHERE role = 'client' AND client_id = ? ORDER BY id", [
        req.params.id,
      ]),
    ),
  ),
  /** Creates the client's first login, or resets the password of its existing one. */
  issueLogin: asyncHandler(async (req, res) => {
    const client = await clientService.getById(req.params.id);
    const existing = await queryOne("SELECT id FROM users WHERE role = 'client' AND client_id = ? ORDER BY is_active DESC, id LIMIT 1", [
      client.id,
    ]);
    let result;
    if (existing) {
      await query('UPDATE users SET is_active = 1 WHERE id = ?', [existing.id]);
      result = await authService.resetPassword(existing.id);
    } else {
      const email = req.body.email || client.email;
      if (!email) throw ApiError.badRequest('লগইন তৈরির জন্য ক্লায়েন্টের ইমেইল দিন');
      result = await authService.register({ name: client.contact_person || client.name, email, role: 'client', client_id: client.id, phone: client.phone });
    }
    await logActivity({ userId: req.user.id, action: 'issue_login', entityType: 'client', entityId: client.id, ip: req.ip });
    ok(res, result);
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
