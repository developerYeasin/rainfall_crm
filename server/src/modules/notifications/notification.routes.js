import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, noContent } from '../../utils/response.js';
import { query, queryOne } from '../../db/pool.js';

/** A user's own notifications — always filtered by req.user.id, for every role. */
const router = Router();

router.get(
  '/',
  validate(z.object({ limit: z.coerce.number().int().min(1).max(100).default(30) }), 'query'),
  asyncHandler(async (req, res) => {
    const rows = await query(
      `SELECT n.id, n.type, n.data, n.link, n.client_id, n.read_at, n.created_at
       FROM notifications n WHERE n.user_id = ? ORDER BY n.id DESC LIMIT ${req.validatedQuery.limit}`,
      [req.user.id],
    );
    const { unread } = await queryOne('SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND read_at IS NULL', [
      req.user.id,
    ]);
    ok(
      res,
      rows.map((r) => ({ ...r, data: typeof r.data === 'string' ? JSON.parse(r.data) : r.data })),
      { unread: Number(unread) },
    );
  }),
);

router.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    await query('UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL', [req.user.id]);
    noContent(res);
  }),
);

router.post(
  '/:id/read',
  validate(z.object({ id: z.coerce.number().int().positive() }), 'params'),
  asyncHandler(async (req, res) => {
    await query('UPDATE notifications SET read_at = COALESCE(read_at, NOW()) WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    noContent(res);
  }),
);

export default router;
