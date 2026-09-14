import bcrypt from 'bcryptjs';
import { query, queryOne } from '../../db/pool.js';
import { ApiError } from '../../utils/ApiError.js';
import { buildWhere, buildPagination, buildOrder } from '../../utils/sql.js';

const FIELDS = `id, name, email, role, client_id,
  (SELECT c.name FROM clients c WHERE c.id = users.client_id) AS client_name,
  phone, is_active, last_login_at, created_at, updated_at`;
const SORTABLE = ['id', 'name', 'email', 'role', 'created_at', 'last_login_at'];

export const userService = {
  async list(filters) {
    const { limit, offset, page } = buildPagination(filters);
    const { sql: where, params } = buildWhere([
      ['(name LIKE ? OR email LIKE ?)', filters.search ? `%${filters.search}%` : undefined],
      ['role = ?', filters.role],
      ['is_active = ?', filters.is_active],
    ]);
    // The search clause carries two placeholders for one value.
    const finalParams = filters.search ? [params[0], params[0], ...params.slice(1)] : params;
    const order = buildOrder(filters.sortBy, filters.sortDir, SORTABLE, 'created_at');

    const rows = await query(`SELECT ${FIELDS} FROM users ${where} ${order} LIMIT ${limit} OFFSET ${offset}`, finalParams);
    const { total } = await queryOne(`SELECT COUNT(*) AS total FROM users ${where}`, finalParams);
    return { rows, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
  },

  async getById(id) {
    const user = await queryOne(`SELECT ${FIELDS} FROM users WHERE id = ?`, [id]);
    if (!user) throw ApiError.notFound('ইউজার পাওয়া যায়নি');
    return user;
  },

  async update(id, payload) {
    const current = await this.getById(id);
    const next = { ...current, ...payload };
    // A client login must always point at a client; staff never do.
    if (next.role === 'client' && !next.client_id) throw ApiError.badRequest('ক্লায়েন্ট অ্যাকাউন্টের জন্য ক্লায়েন্ট বেছে নিন');
    const patch = next.role === 'client' ? payload : { ...payload, client_id: null };

    const sets = [];
    const params = [];
    for (const [key, value] of Object.entries(patch)) {
      if (key === 'password') {
        sets.push('password_hash = ?');
        params.push(await bcrypt.hash(value, 10));
      } else {
        sets.push(`${key} = ?`);
        params.push(typeof value === 'boolean' ? Number(value) : value);
      }
    }
    if (!sets.length) return this.getById(id);
    await query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
    return this.getById(id);
  },

  async deactivate(id, actingUserId) {
    if (Number(id) === Number(actingUserId)) throw ApiError.badRequest('নিজের অ্যাকাউন্ট নিষ্ক্রিয় করা যাবে না');
    await this.getById(id);
    await query('UPDATE users SET is_active = 0 WHERE id = ?', [id]);
    await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL', [id]);
  },
};
