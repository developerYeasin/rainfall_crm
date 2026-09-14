import { createApp } from './app.js';
import { config } from './config/index.js';
import { pool, healthCheck } from './db/pool.js';
import { runMigrations } from './db/migrate.js';

const start = async () => {
  try {
    await healthCheck();
    console.log(`[db] connected to ${config.db.database}@${config.db.host}`);
    await runMigrations();
  } catch (err) {
    console.error('[db] startup failed:', err.message);
    process.exit(1);
  }

  const server = createApp().listen(config.port, () => {
    console.log(`[api] listening on http://localhost:${config.port} (${config.env})`);
  });

  const shutdown = async (signal) => {
    console.log(`\n[api] ${signal} received, shutting down`);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

start();
