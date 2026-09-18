import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The .env lives at the server root, one level above src/, regardless of cwd.
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(rootDir, '.env') });

const required = (key, fallback) => {
  const value = process.env[key] ?? fallback;
  if (value === undefined) throw new Error(`Missing required env var: ${key}`);
  return value;
};

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  db: {
    host: required('DB_HOST'),
    port: Number(process.env.DB_PORT || 3306),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    database: required('DB_NAME'),
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  },
  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '2h',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '30d',
  },
  /** Encrypts stored ad-account tokens. Falls back to the JWT secret outside production. */
  credentialsKey:
    process.env.CREDENTIALS_KEY ||
    (process.env.NODE_ENV === 'production' ? required('CREDENTIALS_KEY') : required('JWT_ACCESS_SECRET')),
  meta: {
    apiVersion: process.env.META_API_VERSION || 'v21.0',
    /** Business-partner system-user token, used for accounts without their own token. */
    accessToken: process.env.META_ACCESS_TOKEN || null,
    /** Facebook app used for the "Connect with Facebook" button (OAuth). Both are needed to show it. */
    appId: process.env.META_APP_ID || null,
    appSecret: process.env.META_APP_SECRET || null,
  },
  /** Public base URL of this API (for OAuth redirects). Falls back to the request's own host. */
  apiPublicUrl: process.env.API_PUBLIC_URL || null,
  google: {
    apiVersion: process.env.GOOGLE_ADS_API_VERSION || 'v20',
    developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || null,
    clientId: process.env.GOOGLE_ADS_CLIENT_ID || null,
    clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET || null,
    /** Refresh token of the agency login; per-account tokens override it. */
    refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN || null,
    /** The agency's manager (MCC) account id, required when accessing client accounts through it. */
    loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || null,
  },
  tiktok: {
    accessToken: process.env.TIKTOK_ACCESS_TOKEN || null,
  },
  jobs: {
    enabled: process.env.JOBS_ENABLED !== 'false',
    // Near real-time by default: every 30 minutes (minimum 15).
    adSyncHours: Number(process.env.AD_SYNC_INTERVAL_HOURS || 0.5),
    appUrl: process.env.APP_URL || 'http://localhost:5173',
  },
  smtp: {
    host: process.env.SMTP_HOST || null,
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || null,
    password: process.env.SMTP_PASSWORD || null,
    from: process.env.SMTP_FROM || 'Rainfall Media <no-reply@rainfall.com>',
  },
  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@rainfall.com',
    adminPassword: process.env.SEED_ADMIN_PASSWORD || 'Admin@123',
  },
};
