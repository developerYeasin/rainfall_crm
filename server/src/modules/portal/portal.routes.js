import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import { logActivity } from '../../utils/activity.js';
import { clientStaffIds, clientUserIds, notifyUsers } from '../../utils/notify.js';
import { query, queryOne } from '../../db/pool.js';
import { toDateOnly } from '../../utils/date.js';
import { ROLES } from '../../config/constants.js';
import { adsService } from '../ads/ads.service.js';
import { financeService } from '../finance/finance.service.js';
import { businessService } from '../business/business.service.js';
import { sendWorkbook, accountingWorkbook, salesWorkbook, sendAccountingPdf } from '../exports/reports.js';

/**
 * Client-dashboard modules that sit next to the sales/stock ledger. Mounted inside the
 * business router, so req.clientId is already pinned and access-checked.
 */
const router = Router();
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'তারিখ YYYY-MM-DD ফরম্যাটে দিন');
const thisYear = () => new Date().getFullYear();
const yearQuery = z.object({ year: z.coerce.number().int().min(2000).max(2100).default(thisYear()) });
const isClient = (req) => req.user.role === ROLES.CLIENT;

const exportAudit = (req, entityType, meta) =>
  logActivity({ userId: req.user.id, action: 'export', entityType, entityId: req.clientId, meta, ip: req.ip });

// ---------------------------------------------------------------- ads
router.get(
  '/ads',
  validate(z.object({ from: dateStr.optional(), to: dateStr.optional(), group: z.enum(['day', 'week', 'month']).default('day') }), 'query'),
  asyncHandler(async (req, res) => ok(res, await adsService.insights(req.clientId, req.validatedQuery))),
);

// ---------------------------------------------------------------- accounting & invoices
router.get(
  '/accounting',
  validate(yearQuery, 'query'),
  asyncHandler(async (req, res) => ok(res, await financeService.clientAccounting(req.clientId, req.validatedQuery.year))),
);

router.get(
  '/invoices',
  asyncHandler(async (req, res) => {
    const { rows, meta } = await financeService.listInvoices(null, { client_id: req.clientId });
    ok(res, rows, meta);
  }),
);

router.get(
  '/export/accounting.xlsx',
  validate(yearQuery, 'query'),
  asyncHandler(async (req, res) => {
    const { year } = req.validatedQuery;
    const [report, invoices] = await Promise.all([
      financeService.clientAccounting(req.clientId, year),
      financeService.listInvoices(null, { client_id: req.clientId, from: `${year}-01-01`, to: `${year}-12-31` }),
    ]);
    await exportAudit(req, 'client_accounting_xlsx', { year });
    await sendWorkbook(res, `accounting-${req.clientId}-${year}.xlsx`, accountingWorkbook(report, invoices.rows));
  }),
);

router.get(
  '/export/accounting.pdf',
  validate(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/, 'মাস YYYY-MM ফরম্যাটে দিন') }), 'query'),
  asyncHandler(async (req, res) => {
    const { month } = req.validatedQuery;
    const year = Number(month.slice(0, 4));
    const from = `${month}-01`;
    const to = toDateOnly(new Date(Date.UTC(year, Number(month.slice(5, 7)), 0)));
    const [report, invoices, ads] = await Promise.all([
      financeService.clientAccounting(req.clientId, year),
      financeService.listInvoices(null, { client_id: req.clientId, from, to: from }),
      adsService.insights(req.clientId, { from, to, group: 'month' }),
    ]);
    await exportAudit(req, 'client_accounting_pdf', { month });
    sendAccountingPdf(res, `report-${req.clientId}-${month}.pdf`, {
      report,
      month,
      invoices: invoices.rows,
      ads: ads.totals.spend > 0 ? ads : null,
    });
  }),
);

router.get(
  '/export/sales.xlsx',
  validate(z.object({ from: dateStr.optional(), to: dateStr.optional() }), 'query'),
  asyncHandler(async (req, res) => {
    // listOrders caps a page at 200; exports page through everything.
    const all = [];
    for (let page = 1; ; page += 1) {
      const { rows } = await businessService.listOrders(req.clientId, { ...req.validatedQuery, page, limit: 200 });
      all.push(...rows);
      if (rows.length < 200) break;
    }
    await exportAudit(req, 'sales_xlsx', req.validatedQuery);
    await sendWorkbook(res, `sales-${req.clientId}.xlsx`, salesWorkbook(all));
  }),
);

// ---------------------------------------------------------------- communication
const messageSchema = z.object({
  body: z.string().trim().min(1, 'মেসেজ লিখুন').max(4000),
  kind: z.enum(['message', 'announcement', 'note']).default('message'),
});

router.get(
  '/messages',
  validate(z.object({ before: z.coerce.number().int().positive().optional() }), 'query'),
  asyncHandler(async (req, res) => {
    // Internal notes never reach a client login.
    const hideNotes = isClient(req) ? "AND m.kind <> 'note'" : '';
    const before = req.validatedQuery.before ? `AND m.id < ${Number(req.validatedQuery.before)}` : '';
    const rows = await query(
      `SELECT m.id, m.kind, m.body, m.created_at, m.user_id, u.name AS user_name, u.role AS user_role
       FROM client_messages m LEFT JOIN users u ON u.id = m.user_id
       WHERE m.client_id = ? ${hideNotes} ${before}
       ORDER BY m.id DESC LIMIT 100`,
      [req.clientId],
    );
    ok(res, rows.reverse());
  }),
);

router.post(
  '/messages',
  validate(messageSchema),
  asyncHandler(async (req, res) => {
    const kind = isClient(req) ? 'message' : req.body.kind;
    if (kind === 'announcement' && ![ROLES.ADMIN, ROLES.MANAGER, ROLES.MEDIA_BUYER].includes(req.user.role)) {
      throw ApiError.forbidden('এই কাজের অনুমতি নেই');
    }
    const result = await query('INSERT INTO client_messages (client_id, user_id, kind, body) VALUES (?, ?, ?, ?)', [
      req.clientId,
      req.user.id,
      kind,
      req.body.body,
    ]);
    const message = await queryOne(
      `SELECT m.id, m.kind, m.body, m.created_at, m.user_id, u.name AS user_name, u.role AS user_role
       FROM client_messages m LEFT JOIN users u ON u.id = m.user_id WHERE m.id = ?`,
      [result.insertId],
    );

    if (kind !== 'note') {
      const client = await queryOne('SELECT name FROM clients WHERE id = ?', [req.clientId]);
      const preview = req.body.body.slice(0, 120);
      const data = { client: client.name, from: req.user.name, preview, kind };
      // Every recipient also gets the message in their account mailbox.
      const email = {
        subject: kind === 'announcement' ? `Update from Rainfall Media — ${client.name}` : `New message from ${req.user.name} — ${client.name}`,
        text: `${req.body.body}\n\n— ${req.user.name}\nReply in Rainfall CRM.`,
      };
      if (isClient(req)) {
        await notifyUsers(await clientStaffIds(req.clientId), { type: 'client_message', data, link: 'business:messages', clientId: req.clientId, email });
      } else {
        const staff = (await clientStaffIds(req.clientId)).filter((id) => id !== req.user.id);
        await notifyUsers(await clientUserIds(req.clientId), {
          type: kind === 'announcement' ? 'announcement' : 'agency_message',
          data,
          link: 'business:messages',
          clientId: req.clientId,
          email,
        });
        await notifyUsers(staff, { type: 'agency_message', data, link: 'business:messages', clientId: req.clientId, email });
      }
    }
    created(res, message);
  }),
);

export default router;
