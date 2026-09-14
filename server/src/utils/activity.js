import { pool } from '../db/pool.js';

/** Fire-and-forget audit trail; never breaks the request it logs. */
export const logActivity = async ({ userId = null, action, entityType, entityId = null, meta = null, ip = null }) => {
  try {
    await pool.execute(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, meta, ip) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, action, entityType, entityId != null ? String(entityId) : null, meta ? JSON.stringify(meta) : null, ip],
    );
  } catch (err) {
    console.error('[activity] failed to log:', err.message);
  }
};
