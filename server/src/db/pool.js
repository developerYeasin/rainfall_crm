import mysql from 'mysql2/promise';
import { config } from '../config/index.js';

export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  queueLimit: 0,
  dateStrings: ['DATE'],
  charset: 'utf8mb4_unicode_ci',
  timezone: 'Z',
  decimalNumbers: true,
  // The DB is remote; keepalive plus a short idle timeout stops the server
  // from silently closing pooled sockets under us (ECONNRESET on next use).
  enableKeepAlive: true,
  keepAliveInitialDelay: 10_000,
  idleTimeout: 60_000,
  maxIdle: 3,
});

/** Connection-level faults that are safe to retry once on a fresh socket. */
const TRANSIENT = new Set(['ECONNRESET', 'PROTOCOL_CONNECTION_LOST', 'EPIPE', 'ETIMEDOUT']);

export const query = async (sql, params = []) => {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (err) {
    if (!TRANSIENT.has(err.code)) throw err;
    const [rows] = await pool.execute(sql, params);
    return rows;
  }
};

export const queryOne = async (sql, params = []) => {
  const rows = await query(sql, params);
  return rows[0] ?? null;
};

/** Runs `fn` inside a transaction, rolling back on any thrown error. */
export const withTransaction = async (fn) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

export const healthCheck = async () => {
  const row = await queryOne('SELECT 1 AS ok');
  return row?.ok === 1;
};
