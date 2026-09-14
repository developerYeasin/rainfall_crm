import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { config } from './config/index.js';
import routes from './routes.js';
import { notFoundHandler, errorHandler } from './middlewares/error.js';
import { apiLimiter } from './middlewares/rateLimit.js';
import { healthCheck } from './db/pool.js';

export const createApp = () => {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) =>
        !origin || config.clientOrigins.includes(origin) ? cb(null, true) : cb(new Error('CORS blocked')),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(compression());
  if (config.env !== 'test') app.use(morgan('dev'));

  app.get('/health', async (req, res) => {
    const db = await healthCheck().catch(() => false);
    res.status(db ? 200 : 503).json({ success: db, service: 'rainfall-crm-api', db });
  });

  app.use('/api/v1', apiLimiter, routes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
