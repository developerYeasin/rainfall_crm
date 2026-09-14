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
  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@rainfall.com',
    adminPassword: process.env.SEED_ADMIN_PASSWORD || 'Admin@123',
  },
};
