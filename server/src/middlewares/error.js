import { ApiError } from '../utils/ApiError.js';
import { config } from '../config/index.js';

export const notFoundHandler = (req, res, next) => next(ApiError.notFound(`Route ${req.originalUrl} not found`));

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message || 'Internal server error';
  let details = err.details || null;

  if (err.code === 'ER_DUP_ENTRY') {
    status = 409;
    message = 'এই রেকর্ডটি ইতিমধ্যে আছে (duplicate entry)';
  } else if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    status = 400;
    message = 'সম্পর্কিত রেকর্ড পাওয়া যায়নি (invalid reference)';
  }

  if (status >= 500) console.error('[error]', err);

  res.status(status).json({
    success: false,
    message,
    ...(details ? { details } : {}),
    ...(config.env === 'development' && status >= 500 ? { stack: err.stack } : {}),
  });
};
