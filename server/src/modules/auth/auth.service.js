import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { query, queryOne } from '../../db/pool.js';
import { ApiError } from '../../utils/ApiError.js';

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const signTokens = (user) => {
  const payload = { sub: user.id, role: user.role };
  const accessToken = jwt.sign(payload, config.jwt.accessSecret, { expiresIn: config.jwt.accessExpires });
  const refreshToken = jwt.sign({ ...payload, jti: crypto.randomUUID() }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpires,
  });
  return { accessToken, refreshToken };
};

const storeRefreshToken = async (userId, refreshToken) => {
  const { exp } = jwt.decode(refreshToken);
  await query('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, FROM_UNIXTIME(?))', [
    userId,
    hashToken(refreshToken),
    exp,
  ]);
};

export const authService = {
  async register(payload) {
    const exists = await queryOne('SELECT id FROM users WHERE email = ?', [payload.email]);
    if (exists) throw ApiError.conflict('এই ইমেইলে অ্যাকাউন্ট আছে');

    const hash = await bcrypt.hash(payload.password, 10);
    const rows = await query(
      'INSERT INTO users (name, email, password_hash, role, client_id, phone) VALUES (?, ?, ?, ?, ?, ?)',
      [
        payload.name,
        payload.email,
        hash,
        payload.role,
        payload.role === 'client' ? payload.client_id : null,
        payload.phone ?? null,
      ],
    );
    return this.getById(rows.insertId);
  },

  async getById(id) {
    const user = await queryOne(
      `SELECT u.id, u.name, u.email, u.role, u.client_id, c.name AS client_name,
              u.phone, u.is_active, u.last_login_at, u.created_at
       FROM users u LEFT JOIN clients c ON c.id = u.client_id
       WHERE u.id = ?`,
      [id],
    );
    if (!user) throw ApiError.notFound('ইউজার পাওয়া যায়নি');
    return user;
  },

  async login({ email, password }) {
    const user = await queryOne('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    if (!user) throw ApiError.unauthorized('ইমেইল বা পাসওয়ার্ড ভুল');
    if (!user.is_active) throw ApiError.forbidden('অ্যাকাউন্ট নিষ্ক্রিয়');

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) throw ApiError.unauthorized('ইমেইল বা পাসওয়ার্ড ভুল');

    const tokens = signTokens(user);
    await storeRefreshToken(user.id, tokens.refreshToken);
    await query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

    return { user: await this.getById(user.id), ...tokens };
  },

  async refresh(refreshToken) {
    let payload;
    try {
      payload = jwt.verify(refreshToken, config.jwt.refreshSecret);
    } catch {
      throw ApiError.unauthorized('রিফ্রেশ টোকেন অবৈধ');
    }

    const stored = await queryOne(
      'SELECT id, revoked_at FROM refresh_tokens WHERE token_hash = ? AND expires_at > NOW()',
      [hashToken(refreshToken)],
    );
    if (!stored || stored.revoked_at) throw ApiError.unauthorized('রিফ্রেশ টোকেন বাতিল হয়েছে');

    const user = await this.getById(payload.sub);
    // Rotate: the presented token is retired and a fresh pair is issued.
    await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?', [stored.id]);
    const tokens = signTokens(user);
    await storeRefreshToken(user.id, tokens.refreshToken);
    return { user, ...tokens };
  },

  async logout(refreshToken) {
    if (!refreshToken) return;
    await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL', [
      hashToken(refreshToken),
    ]);
  },

  async changePassword(userId, { currentPassword, newPassword }) {
    const user = await queryOne('SELECT id, password_hash FROM users WHERE id = ?', [userId]);
    if (!user) throw ApiError.notFound('ইউজার পাওয়া যায়নি');
    if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
      throw ApiError.badRequest('বর্তমান পাসওয়ার্ড ভুল');
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, userId]);
    await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL', [userId]);
  },
};
