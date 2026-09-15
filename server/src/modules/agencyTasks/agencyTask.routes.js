import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.js';
import { authorize } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created, noContent } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import { logActivity } from '../../utils/activity.js';
import { notifyUsers } from '../../utils/notify.js';
import { assertClientAccess, getScope, hasGlobalAccess, scopeSql } from '../../utils/access.js';
import { buildWhere } from '../../utils/sql.js';
import { query, queryOne } from '../../db/pool.js';
import { toDateOnly } from '../../utils/date.js';
import { ROLES, TASK_PRIORITIES } from '../../config/constants.js';

/** Agency to-dos and reminders ("update creative for Client X by Friday"). */
const router = Router();
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'তারিখ YYYY-MM-DD ফরম্যাটে দিন');
const idParam = z.object({ id: z.coerce.number().int().positive() });

const taskSchema = z.object({
  title: z.string().trim().min(2, 'টাস্কের নাম দিন').max(200),
  description: z.string().max(4000).nullable().optional(),
  client_id: z.coerce.number().int().positive().nullable().optional(),
  assignee_id: z.coerce.number().int().positive().nullable().optional(),
  due_date: dateStr.nullable().optional(),
  priority: z.enum(TASK_PRIORITIES).default('normal'),
});
const updateSchema = taskSchema.partial().extend({ status: z.enum(['open', 'done']).optional() });
const listSchema = z.object({
  status: z.enum(['open', 'done']).optional(),
  assignee_id: z.coerce.number().int().positive().optional(),
  client_id: z.coerce.number().int().positive().optional(),
  mine: z.enum(['1']).optional(),
});

const SELECT = `
  SELECT t.*, c.name AS client_name, a.name AS assignee_name, cr.name AS created_by_name
  FROM agency_tasks t
  LEFT JOIN clients c ON c.id = t.client_id
  LEFT JOIN users a ON a.id = t.assignee_id
  LEFT JOIN users cr ON cr.id = t.created_by
`;
const decorate = (t, today = toDateOnly(new Date())) => {
  const due = toDateOnly(t.due_date);
  return { ...t, due_date: due, overdue: t.status === 'open' && !!due && due < today };
};

/** Admins see every task; others see tasks assigned to/created by them, or tied to clients they work on. */
const visibility = async (req) => {
  if (hasGlobalAccess(req.user)) return { sql: '', params: [] };
  const scope = scopeSql('t.client_id', await getScope(req));
  return {
    sql: `(t.assignee_id = ? OR t.created_by = ?${req.user.role === ROLES.MANAGER && scope ? ` OR ${scope}` : ''})`,
    params: [req.user.id, req.user.id],
  };
};

const loadTask = async (req, id) => {
  const vis = await visibility(req);
  const row = await queryOne(`${SELECT} WHERE t.id = ? ${vis.sql ? `AND ${vis.sql}` : ''}`, [id, ...vis.params]);
  if (!row) throw ApiError.notFound('টাস্ক পাওয়া যায়নি');
  return decorate(row);
};

const checkRefs = async (req, body) => {
  if (body.client_id) await assertClientAccess(req, body.client_id);
  if (body.assignee_id) {
    const user = await queryOne("SELECT id FROM users WHERE id = ? AND role <> 'client' AND is_active = 1", [body.assignee_id]);
    if (!user) throw ApiError.badRequest('শুধু সক্রিয় টিম মেম্বার অ্যাসাইন করা যায়');
  }
};

router.get(
  '/',
  validate(listSchema, 'query'),
  asyncHandler(async (req, res) => {
    const f = req.validatedQuery;
    const built = buildWhere([
      ['t.status = ?', f.status],
      ['t.assignee_id = ?', f.mine ? req.user.id : f.assignee_id],
      ['t.client_id = ?', f.client_id],
    ]);
    const vis = await visibility(req);
    const where = [built.sql.replace(/^WHERE /, ''), vis.sql].filter(Boolean).join(' AND ');
    const rows = await query(
      `${SELECT} ${where ? `WHERE ${where}` : ''}
       ORDER BY t.status = 'done', t.due_date IS NULL, t.due_date, FIELD(t.priority, 'high', 'normal', 'low'), t.id DESC
       LIMIT 300`,
      [...built.params, ...vis.params],
    );
    ok(res, rows.map((r) => decorate(r)));
  }),
);

router.post(
  '/',
  validate(taskSchema),
  asyncHandler(async (req, res) => {
    await checkRefs(req, req.body);
    // Only leads hand work to someone else; everyone can create their own reminders.
    const assignee = req.body.assignee_id ?? req.user.id;
    if (assignee !== req.user.id && ![ROLES.ADMIN, ROLES.MANAGER].includes(req.user.role)) {
      throw ApiError.forbidden('অন্যকে টাস্ক দিতে পারেন শুধু অ্যাডমিন বা ম্যানেজার');
    }
    const result = await query(
      `INSERT INTO agency_tasks (title, description, client_id, assignee_id, due_date, priority, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.body.title, req.body.description || null, req.body.client_id || null, assignee, req.body.due_date || null, req.body.priority, req.user.id],
    );
    const task = await loadTask(req, result.insertId);
    await logActivity({ userId: req.user.id, action: 'create', entityType: 'agency_task', entityId: task.id, ip: req.ip });
    if (assignee !== req.user.id) {
      await notifyUsers([assignee], {
        type: 'task_assigned',
        data: { title: task.title, by: req.user.name, due_date: task.due_date, client: task.client_name },
        link: '/tasks',
        clientId: task.client_id,
      });
    }
    created(res, task);
  }),
);

router.patch(
  '/:id',
  validate(idParam, 'params'),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const current = await loadTask(req, req.params.id);
    const isLead = [ROLES.ADMIN, ROLES.MANAGER].includes(req.user.role);
    // Assignees may tick their own task off; editing the task itself is for its creator or a lead.
    const onlyStatus = Object.keys(req.body).every((k) => k === 'status');
    if (!isLead && current.created_by !== req.user.id && !(onlyStatus && current.assignee_id === req.user.id)) {
      throw ApiError.forbidden('এই কাজের অনুমতি নেই');
    }
    if (req.body.assignee_id && req.body.assignee_id !== current.assignee_id && !isLead) {
      throw ApiError.forbidden('অন্যকে টাস্ক দিতে পারেন শুধু অ্যাডমিন বা ম্যানেজার');
    }
    await checkRefs(req, req.body);

    const patch = { ...req.body };
    if (patch.status) patch.completed_at = patch.status === 'done' ? new Date() : null;
    const cols = Object.keys(patch);
    if (cols.length) {
      await query(`UPDATE agency_tasks SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [
        ...cols.map((c) => (patch[c] === '' ? null : patch[c])),
        req.params.id,
      ]);
    }
    const task = await loadTask(req, req.params.id);
    await logActivity({ userId: req.user.id, action: 'update', entityType: 'agency_task', entityId: task.id, meta: { changes: req.body }, ip: req.ip });
    if (req.body.assignee_id && req.body.assignee_id !== current.assignee_id && req.body.assignee_id !== req.user.id) {
      await notifyUsers([req.body.assignee_id], {
        type: 'task_assigned',
        data: { title: task.title, by: req.user.name, due_date: task.due_date, client: task.client_name },
        link: '/tasks',
        clientId: task.client_id,
      });
    }
    ok(res, task);
  }),
);

router.delete(
  '/:id',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const task = await loadTask(req, req.params.id);
    if (![ROLES.ADMIN, ROLES.MANAGER].includes(req.user.role) && task.created_by !== req.user.id) {
      throw ApiError.forbidden('এই কাজের অনুমতি নেই');
    }
    await query('DELETE FROM agency_tasks WHERE id = ?', [req.params.id]);
    await logActivity({ userId: req.user.id, action: 'delete', entityType: 'agency_task', entityId: req.params.id, ip: req.ip });
    noContent(res);
  }),
);

export default router;

/** Team roster with workload — who handles which clients and accounts, open/overdue tasks, spend flags. */
export const teamRouter = Router();
teamRouter.get(
  '/',
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    const [users, assignments, accounts, tasks] = await Promise.all([
      query("SELECT id, name, email, role, is_active, last_login_at FROM users WHERE role <> 'client' ORDER BY is_active DESC, name"),
      query(
        `SELECT cs.user_id, c.id, c.name, c.status FROM client_staff cs JOIN clients c ON c.id = cs.client_id ORDER BY c.name`,
      ),
      query('SELECT assigned_user_id AS user_id, COUNT(*) AS total, SUM(last_sync_error IS NOT NULL) AS failing FROM ad_accounts WHERE is_active = 1 GROUP BY assigned_user_id'),
      query(
        `SELECT assignee_id AS user_id, SUM(status = 'open') AS open, SUM(status = 'open' AND due_date < CURDATE()) AS overdue,
                SUM(status = 'done' AND completed_at >= CURDATE() - INTERVAL 30 DAY) AS done_30d
         FROM agency_tasks GROUP BY assignee_id`,
      ),
    ]);
    const accountsBy = new Map(accounts.map((a) => [a.user_id, a]));
    const tasksBy = new Map(tasks.map((t) => [t.user_id, t]));
    ok(
      res,
      users.map((u) => ({
        ...u,
        is_active: !!u.is_active,
        clients: assignments.filter((a) => a.user_id === u.id).map(({ id, name, status }) => ({ id, name, status })),
        ad_accounts: Number(accountsBy.get(u.id)?.total || 0),
        failing_accounts: Number(accountsBy.get(u.id)?.failing || 0),
        open_tasks: Number(tasksBy.get(u.id)?.open || 0),
        overdue_tasks: Number(tasksBy.get(u.id)?.overdue || 0),
        done_tasks_30d: Number(tasksBy.get(u.id)?.done_30d || 0),
      })),
    );
  }),
);
