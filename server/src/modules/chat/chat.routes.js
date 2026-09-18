import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created, noContent } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import { notifyUsers } from '../../utils/notify.js';
import { query, queryOne } from '../../db/pool.js';
import { ROLES } from '../../config/constants.js';
import { config } from '../../config/index.js';

/**
 * Direct messages across the whole ecosystem. Staff can reach every active login;
 * a client login can reach admins, managers and the staff assigned to its own client.
 */
const router = Router();
const userParam = z.object({ userId: z.coerce.number().int().positive() });

const contactsFor = async (user) => {
  if (user.role !== ROLES.CLIENT) {
    return query(
      `SELECT u.id, u.name, u.email, u.role, c.name AS client_name FROM users u
       LEFT JOIN clients c ON c.id = u.client_id
       WHERE u.is_active = 1 AND u.id <> ? ORDER BY u.role = 'client', u.name`,
      [user.id],
    );
  }
  return query(
    `SELECT u.id, u.name, u.email, u.role, NULL AS client_name FROM users u
     WHERE u.is_active = 1 AND u.role <> 'client'
       AND (u.role IN ('admin', 'manager')
            OR u.id IN (SELECT user_id FROM client_staff WHERE client_id = ?)
            OR u.id = (SELECT account_manager_id FROM clients WHERE id = ?))
     ORDER BY u.name`,
    [user.client_id, user.client_id],
  );
};

const assertContact = async (user, otherId) => {
  const contacts = await contactsFor(user);
  const contact = contacts.find((c) => c.id === Number(otherId));
  if (!contact) throw ApiError.notFound('ইউজার পাওয়া যায়নি');
  return contact;
};

router.get(
  '/contacts',
  asyncHandler(async (req, res) => {
    const contacts = await contactsFor(req.user);
    const stats = await query(
      `SELECT other_id, MAX(id) AS last_id, SUM(unread) AS unread FROM (
         SELECT recipient_id AS other_id, id, 0 AS unread FROM direct_messages WHERE sender_id = ?
         UNION ALL
         SELECT sender_id AS other_id, id, read_at IS NULL AS unread FROM direct_messages WHERE recipient_id = ?
       ) t GROUP BY other_id`,
      [req.user.id, req.user.id],
    );
    const lastIds = stats.map((s) => Number(s.last_id));
    const lastRows = lastIds.length
      ? await query(`SELECT id, body, sender_id, created_at FROM direct_messages WHERE id IN (${lastIds.join(', ')})`)
      : [];
    const lastById = new Map(lastRows.map((r) => [Number(r.id), r]));
    const statByUser = new Map(stats.map((s) => [Number(s.other_id), s]));

    const rows = contacts
      .map((c) => {
        const s = statByUser.get(c.id);
        const last = s ? lastById.get(Number(s.last_id)) : null;
        return {
          ...c,
          unread: Number(s?.unread || 0),
          last_message: last ? { body: last.body.slice(0, 80), mine: last.sender_id === req.user.id, created_at: last.created_at } : null,
        };
      })
      .sort((a, b) => (b.last_message ? new Date(b.last_message.created_at) : 0) - (a.last_message ? new Date(a.last_message.created_at) : 0));
    ok(res, rows);
  }),
);

router.get(
  '/unread',
  asyncHandler(async (req, res) => {
    const { unread } = await queryOne('SELECT COUNT(*) AS unread FROM direct_messages WHERE recipient_id = ? AND read_at IS NULL', [
      req.user.id,
    ]);
    const channel = req.user.role === ROLES.CLIENT ? 0 : await channelUnread(req.user.id);
    ok(res, { unread: Number(unread) + channel, direct: Number(unread), channel });
  }),
);

// ---------------------------------------------------------------- team channel (staff only)
const channelUnread = async (userId) => {
  const row = await queryOne(
    `SELECT COUNT(*) AS n FROM channel_messages
     WHERE sender_id <> ? AND id > COALESCE((SELECT last_read_id FROM channel_reads WHERE user_id = ?), 0)`,
    [userId, userId],
  );
  return Number(row.n);
};

const staffOnlyChannel = (req, res, next) =>
  req.user.role === ROLES.CLIENT ? next(ApiError.forbidden('এই তথ্য দেখার অনুমতি নেই')) : next();

const CHANNEL_SELECT = `SELECT m.id, m.sender_id, u.name AS sender_name, u.role AS sender_role, m.body, m.created_at
  FROM channel_messages m JOIN users u ON u.id = m.sender_id`;

router.get(
  '/channel/team',
  staffOnlyChannel,
  asyncHandler(async (req, res) => {
    const rows = await query(`${CHANNEL_SELECT} ORDER BY m.id DESC LIMIT 200`);
    const lastId = rows[0]?.id ?? 0;
    await query(
      'INSERT INTO channel_reads (user_id, last_read_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE last_read_id = GREATEST(last_read_id, VALUES(last_read_id))',
      [req.user.id, lastId],
    );
    const { members } = await queryOne("SELECT COUNT(*) AS members FROM users WHERE is_active = 1 AND role <> 'client'");
    ok(res, { members: Number(members), messages: rows.reverse() });
  }),
);

router.post(
  '/channel/team',
  staffOnlyChannel,
  validate(z.object({ body: z.string().trim().min(1, 'মেসেজ লিখুন').max(4000) })),
  asyncHandler(async (req, res) => {
    const result = await query('INSERT INTO channel_messages (sender_id, body) VALUES (?, ?)', [req.user.id, req.body.body]);
    await query(
      'INSERT INTO channel_reads (user_id, last_read_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE last_read_id = VALUES(last_read_id)',
      [req.user.id, result.insertId],
    );
    const team = await query("SELECT id FROM users WHERE is_active = 1 AND role <> 'client' AND id <> ?", [req.user.id]);
    await notifyUsers(
      team.map((u) => u.id),
      {
        type: 'channel_message',
        data: { from: req.user.name, preview: req.body.body.slice(0, 120) },
        link: '/inbox/team',
        email: {
          subject: `${req.user.name} in the team channel — Rainfall CRM`,
          text: `${req.user.name} wrote in the team channel:\n\n${req.body.body}\n\nReply here: ${config.jobs.appUrl}/inbox/team`,
        },
      },
    );
    created(res, await queryOne(`${CHANNEL_SELECT} WHERE m.id = ?`, [result.insertId]));
  }),
);

router.get(
  '/:userId',
  validate(userParam, 'params'),
  asyncHandler(async (req, res) => {
    const other = await assertContact(req.user, req.params.userId);
    const rows = await query(
      `SELECT id, sender_id, recipient_id, body, read_at, created_at FROM direct_messages
       WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
       ORDER BY id DESC LIMIT 200`,
      [req.user.id, other.id, other.id, req.user.id],
    );
    await query('UPDATE direct_messages SET read_at = NOW() WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL', [
      other.id,
      req.user.id,
    ]);
    ok(res, { contact: other, messages: rows.reverse() });
  }),
);

router.post(
  '/:userId',
  validate(userParam, 'params'),
  validate(z.object({ body: z.string().trim().min(1, 'মেসেজ লিখুন').max(4000) })),
  asyncHandler(async (req, res) => {
    const other = await assertContact(req.user, req.params.userId);
    const result = await query('INSERT INTO direct_messages (sender_id, recipient_id, body) VALUES (?, ?, ?)', [
      req.user.id,
      other.id,
      req.body.body,
    ]);
    const message = await queryOne('SELECT id, sender_id, recipient_id, body, read_at, created_at FROM direct_messages WHERE id = ?', [
      result.insertId,
    ]);
    // In-app notification plus an email copy to the recipient's account address.
    await notifyUsers([other.id], {
      type: 'direct_message',
      data: { from: req.user.name, preview: req.body.body.slice(0, 120) },
      link: `/inbox/${req.user.id}`,
      email: {
        subject: `New message from ${req.user.name} — Rainfall CRM`,
        text: `${req.user.name} sent you a message:\n\n${req.body.body}\n\nReply here: ${config.jobs.appUrl}/inbox/${req.user.id}`,
      },
    });
    created(res, message);
  }),
);

router.post(
  '/:userId/read',
  validate(userParam, 'params'),
  asyncHandler(async (req, res) => {
    await query('UPDATE direct_messages SET read_at = NOW() WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL', [
      req.params.userId,
      req.user.id,
    ]);
    noContent(res);
  }),
);

export default router;
