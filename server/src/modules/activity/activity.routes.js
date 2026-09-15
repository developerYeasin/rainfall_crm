import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.js';
import { authorize } from '../../middlewares/auth.js';
import { ROLES } from '../../config/constants.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/response.js';
import { query, queryOne } from '../../db/pool.js';
import { buildWhere, buildPagination } from '../../utils/sql.js';

const router = Router();

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  entity_type: z.string().max(60).optional(),
  user_id: z.coerce.number().int().positive().optional(),
});

// Agency-wide audit trail spans every client, so it is admin-only.
router.get(
  '/',
  authorize(ROLES.ADMIN),
  validate(listSchema, 'query'),
  asyncHandler(async (req, res) => {
    const filters = req.validatedQuery;
    const { limit, offset, page } = buildPagination(filters);
    const { sql: where, params } = buildWhere([
      ['a.entity_type = ?', filters.entity_type],
      ['a.user_id = ?', filters.user_id],
    ]);
    const rows = await query(
      `SELECT a.*, u.name AS user_name FROM activity_logs a
       LEFT JOIN users u ON u.id = a.user_id
       ${where} ORDER BY a.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      params,
    );
    const { total } = await queryOne(`SELECT COUNT(*) AS total FROM activity_logs a ${where}`, params);
    ok(res, rows, { total, page, limit, pages: Math.ceil(total / limit) });
  }),
);

export default router;
