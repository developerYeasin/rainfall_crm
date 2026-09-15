import { clientRepository } from './client.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { query, withTransaction } from '../../db/pool.js';

/** Empty strings from form inputs are stored as NULL. */
const normalise = (payload) =>
  Object.fromEntries(Object.entries(payload).map(([k, v]) => [k, v === '' ? null : v]));

export const clientService = {
  async list(filters) {
    const { rows, meta } = await clientRepository.list(filters);
    const stats = await clientRepository.stats(rows.map((r) => r.id));
    return { rows: rows.map((r) => ({ ...r, ...stats.get(r.id) })), meta };
  },

  async getById(id) {
    const client = await clientRepository.findById(id);
    if (!client) throw ApiError.notFound('ক্লায়েন্ট পাওয়া যায়নি');
    return client;
  },

  async getWithCycles(id) {
    const client = await this.getById(id);
    const cycles = await query(
      'SELECT id, name, month_start, weeks_count, status, monthly_budget FROM cycles WHERE client_id = ? ORDER BY month_start DESC',
      [id],
    );
    return { ...client, cycles };
  },

  async create(payload, userId, { assignCreator = false } = {}) {
    const id = await clientRepository.insert({ ...normalise(payload), created_by: userId });
    const assignees = [assignCreator && userId, payload.account_manager_id].filter(Boolean);
    for (const uid of assignees) {
      await query('INSERT IGNORE INTO client_staff (client_id, user_id) VALUES (?, ?)', [id, uid]);
    }
    return this.getById(id);
  },

  async update(id, payload) {
    await this.getById(id);
    await clientRepository.update(id, normalise(payload));
    if (payload.account_manager_id) {
      await query('INSERT IGNORE INTO client_staff (client_id, user_id) VALUES (?, ?)', [id, payload.account_manager_id]);
    }
    return this.getById(id);
  },

  async remove(id) {
    await this.getById(id);
    await clientRepository.remove(id);
  },

  async staff(id) {
    await this.getById(id);
    return query(
      `SELECT u.id, u.name, u.email, u.role FROM client_staff cs
       JOIN users u ON u.id = cs.user_id
       WHERE cs.client_id = ? ORDER BY u.name`,
      [id],
    );
  },

  /** Replaces the assignment list. Only active agency staff can be assigned. */
  async setStaff(id, userIds) {
    await this.getById(id);
    const unique = [...new Set(userIds.map(Number))];
    if (unique.length) {
      const valid = await query(
        `SELECT id FROM users WHERE role <> 'client' AND is_active = 1 AND id IN (${unique.join(', ')})`,
      );
      if (valid.length !== unique.length) throw ApiError.badRequest('শুধু সক্রিয় টিম মেম্বার অ্যাসাইন করা যায়');
    }
    await withTransaction(async (conn) => {
      await conn.execute('DELETE FROM client_staff WHERE client_id = ?', [id]);
      for (const uid of unique) {
        await conn.execute('INSERT INTO client_staff (client_id, user_id) VALUES (?, ?)', [id, uid]);
      }
    });
    return this.staff(id);
  },

  statusCounts: () => clientRepository.statusCounts(),
};
