import { query, queryOne } from '../db/pool.js';
import { ApiError } from './ApiError.js';
import { asyncHandler } from './asyncHandler.js';
import { ROLES } from '../config/constants.js';

/**
 * Tenant isolation. Every client-owned read or write goes through one of these helpers.
 *
 *   admin   → every client (scope = null)
 *   client  → only users.client_id
 *   staff   → clients they are assigned to (client_staff) or account-manage
 *
 * Out-of-scope clients answer 404, so ids cannot be probed through the URL.
 */

export const GLOBAL_ROLES = [ROLES.ADMIN];
export const hasGlobalAccess = (user) => GLOBAL_ROLES.includes(user?.role);

const loadScope = async (user) => {
  if (hasGlobalAccess(user)) return null;
  if (user.role === ROLES.CLIENT) return user.client_id ? [Number(user.client_id)] : [];
  const rows = await query(
    `SELECT client_id FROM client_staff WHERE user_id = ?
     UNION SELECT id FROM clients WHERE account_manager_id = ?`,
    [user.id, user.id],
  );
  return rows.map((r) => Number(r.client_id));
};

/** Client ids the request's user may touch, cached on the request. null = all. */
export const getScope = async (req) => {
  if (req.clientScope === undefined) req.clientScope = await loadScope(req.user);
  return req.clientScope;
};

export const inScope = (scope, clientId) => scope === null || scope.includes(Number(clientId));

/** SQL fragment restricting `column` to the scope; ids are integers so inlining is safe. */
export const scopeSql = (column, scope) => {
  if (scope === null) return '';
  if (!scope.length) return '1 = 0';
  return `${column} IN (${scope.map((id) => Number(id)).join(', ')})`;
};

/** Appends an extra condition to a "WHERE …" string produced by buildWhere. */
export const andWhere = (where, extra) => {
  if (!extra) return where;
  return where ? `${where} AND ${extra}` : `WHERE ${extra}`;
};

export const assertClientAccess = async (req, clientId) => {
  if (!inScope(await getScope(req), clientId)) throw ApiError.notFound('ক্লায়েন্ট পাওয়া যায়নি');
};

export const clientIdOfCycle = async (cycleId) =>
  (await queryOne('SELECT client_id FROM cycles WHERE id = ?', [cycleId]))?.client_id ?? null;

/** For tables hanging off a cycle (performance_entries, task_compliance, content_calendar). */
const CYCLE_CHILD_TABLES = new Set(['performance_entries', 'task_compliance', 'content_calendar']);
export const clientIdOfCycleRow = async (table, id) => {
  if (!CYCLE_CHILD_TABLES.has(table)) throw new Error(`clientIdOfCycleRow: unsupported table ${table}`);
  const row = await queryOne(`SELECT cy.client_id FROM ${table} t JOIN cycles cy ON cy.id = t.cycle_id WHERE t.id = ?`, [id]);
  return row?.client_id ?? null;
};

/**
 * Middleware: resolves the client a request targets and rejects it when out of scope.
 * A resolver returning null means "record doesn't exist" — the service will 404 on its own.
 */
export const guardClient = (resolve) =>
  asyncHandler(async (req, res, next) => {
    const clientId = await resolve(req);
    if (clientId !== null && clientId !== undefined) await assertClientAccess(req, clientId);
    next();
  });

export const guardCycle = (pick) => guardClient((req) => clientIdOfCycle(pick(req)));
export const guardCycleRow = (table) => guardClient((req) => clientIdOfCycleRow(table, req.params.id));

/** Adds `scope` onto the validated query so list services can filter. */
export const attachScope = asyncHandler(async (req, res, next) => {
  req.validatedQuery = { ...(req.validatedQuery || {}), scope: await getScope(req) };
  next();
});

/**
 * Pins a client-portal request to one client: a client login is ALWAYS its own client_id
 * (the query is ignored); staff pass ?client_id= and must have it in scope.
 */
export const resolveClientParam = asyncHandler(async (req, res, next) => {
  if (req.user.role === ROLES.CLIENT) {
    if (!req.user.client_id) throw ApiError.forbidden('এই অ্যাকাউন্টে কোনো ক্লায়েন্ট যুক্ত নেই');
    req.clientId = Number(req.user.client_id);
  } else {
    const id = Number(req.query.client_id);
    if (!Number.isInteger(id) || id <= 0) throw ApiError.badRequest('client_id দিন');
    await assertClientAccess(req, id);
    req.clientId = id;
  }
  const exists = await queryOne('SELECT id FROM clients WHERE id = ?', [req.clientId]);
  if (!exists) throw ApiError.notFound('ক্লায়েন্ট পাওয়া যায়নি');
  next();
});
