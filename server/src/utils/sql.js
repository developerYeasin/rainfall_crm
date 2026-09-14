/** Builds "WHERE a = ? AND b LIKE ?" from a list of [condition, value] pairs. */
export const buildWhere = (clauses) => {
  const active = clauses.filter(([, value]) => value !== undefined && value !== null && value !== '');
  return {
    sql: active.length ? `WHERE ${active.map(([c]) => c).join(' AND ')}` : '',
    params: active.map(([, value]) => value),
  };
};

/** LIMIT/OFFSET are inlined as integers — mysql2 prepared statements reject them as params. */
export const buildPagination = ({ page = 1, limit = 25 }) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 200);
  const safePage = Math.max(Number(page) || 1, 1);
  return { limit: safeLimit, offset: (safePage - 1) * safeLimit, page: safePage };
};

/** Whitelisted ORDER BY, guarding against injection through query params. */
export const buildOrder = (sortBy, sortDir, allowed, fallback) => {
  const column = allowed.includes(sortBy) ? sortBy : fallback;
  const dir = String(sortDir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return `ORDER BY ${column} ${dir}`;
};
