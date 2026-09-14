import { ApiError } from '../utils/ApiError.js';

/** Validates and REPLACES req[source] with the parsed value. */
export const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    return next(
      ApiError.badRequest(
        'ভ্যালিডেশন ব্যর্থ হয়েছে',
        result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      ),
    );
  }
  if (source === 'query') req.validatedQuery = result.data;
  else req[source] = result.data;
  next();
};
