import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { ApiError } from '../utils/ApiError.js';
import { queryOne } from '../db/pool.js';
import { ROLES } from '../config/constants.js';

export const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw ApiError.unauthorized('টোকেন পাওয়া যায়নি');

    let payload;
    try {
      payload = jwt.verify(token, config.jwt.accessSecret);
    } catch {
      throw ApiError.unauthorized('টোকেন অবৈধ বা মেয়াদোত্তীর্ণ');
    }

    const user = await queryOne(
      'SELECT id, name, email, role, client_id, is_active FROM users WHERE id = ? LIMIT 1',
      [payload.sub],
    );
    if (!user || !user.is_active) throw ApiError.unauthorized('অ্যাকাউন্ট নিষ্ক্রিয়');

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

/** Blocks client logins from agency-internal routes. */
export const staffOnly = (req, res, next) => {
  if (req.user?.role === ROLES.CLIENT) return next(ApiError.forbidden('এই তথ্য দেখার অনুমতি নেই'));
  next();
};

export const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (roles.length && !roles.includes(req.user.role)) {
    return next(ApiError.forbidden('এই কাজের অনুমতি নেই'));
  }
  next();
};
