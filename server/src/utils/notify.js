import { query } from '../db/pool.js';
import { sendMail } from './mailer.js';

/**
 * In-app notifications, stored per recipient. `type` + `data` are rendered by the web app
 * (so they follow the viewer's language); `email` sends a plain-English copy when SMTP is set.
 */
export const notifyUsers = async (userIds, { type, data = {}, link = null, clientId = null, dedupeKey = null, email = null }) => {
  const ids = [...new Set(userIds.map(Number).filter(Boolean))];
  if (!ids.length) return;
  try {
    for (const userId of ids) {
      await query(
        'INSERT IGNORE INTO notifications (user_id, client_id, type, data, link, dedupe_key) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, clientId, type, JSON.stringify(data), link, dedupeKey],
      );
    }
    if (email) {
      const rows = await query(
        `SELECT email FROM users WHERE is_active = 1 AND id IN (${ids.join(', ')})`,
      );
      await sendMail({ to: rows.map((r) => r.email), ...email });
    }
  } catch (err) {
    console.error('[notify] failed:', err.message);
  }
};

const ids = (rows) => rows.map((r) => r.id);

export const adminIds = async () => ids(await query("SELECT id FROM users WHERE role = 'admin' AND is_active = 1"));

/** Active client-portal logins of one client. */
export const clientUserIds = async (clientId) =>
  ids(await query("SELECT id FROM users WHERE role = 'client' AND client_id = ? AND is_active = 1", [clientId]));

/** Staff assigned to a client (incl. its account manager). */
export const clientStaffIds = async (clientId) =>
  ids(
    await query(
      `SELECT u.id FROM users u
       WHERE u.is_active = 1 AND u.role <> 'client'
         AND (u.id IN (SELECT user_id FROM client_staff WHERE client_id = ?)
              OR u.id = (SELECT account_manager_id FROM clients WHERE id = ?))`,
      [clientId, clientId],
    ),
  );
