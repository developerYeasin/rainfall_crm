import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pool } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

const ensureTable = async (conn) => {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      filename VARCHAR(191) NOT NULL,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_migration_file (filename)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

/** Splits a .sql file into statements. Migrations here contain no routines/delimiters. */
const splitStatements = (sql) =>
  sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length && !s.startsWith('--'));

export const runMigrations = async () => {
  const conn = await pool.getConnection();
  try {
    await ensureTable(conn);
    const [applied] = await conn.query('SELECT filename FROM schema_migrations');
    const done = new Set(applied.map((r) => r.filename));

    const files = (await fs.readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      for (const statement of splitStatements(sql)) {
        await conn.query(statement);
      }
      await conn.query('INSERT INTO schema_migrations (filename) VALUES (?)', [file]);
      console.log(`[migrate] applied ${file}`);
    }
    console.log('[migrate] up to date');
  } finally {
    conn.release();
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMigrations()
    .then(() => pool.end())
    .catch((err) => {
      console.error('[migrate] failed:', err.message);
      pool.end();
      process.exit(1);
    });
}
