import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.js';
import { authorize } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created, noContent } from '../../utils/response.js';
import { logActivity } from '../../utils/activity.js';
import { getScope, guardClient } from '../../utils/access.js';
import { adminIds, clientStaffIds, clientUserIds, notifyUsers } from '../../utils/notify.js';
import { config } from '../../config/index.js';
import { ROLES, FINANCE_ROLES, AGENCY_EXPENSE_CATEGORIES } from '../../config/constants.js';
import { financeService as service } from './finance.service.js';
import { sendWorkbook, agencyPnlWorkbook } from '../exports/reports.js';

/** Agency finance: invoices & payments (admin/manager), agency expenses & P&L (admin only). */
const router = Router();
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'তারিখ YYYY-MM-DD ফরম্যাটে দিন');
const idParam = z.object({ id: z.coerce.number().int().positive() });
const yearQuery = z.object({ year: z.coerce.number().int().min(2000).max(2100).default(new Date().getFullYear()) });
const adminOnly = authorize(ROLES.ADMIN);

const invoiceSchema = z.object({
  client_id: z.coerce.number().int().positive(),
  period_month: dateStr,
  issue_date: dateStr,
  due_date: dateStr,
  agency_fee: z.coerce.number().min(0).optional(),
  other_charges: z.coerce.number().min(0).optional(),
  note: z.string().max(500).nullable().optional(),
});
const updateInvoiceSchema = invoiceSchema
  .omit({ client_id: true })
  .partial()
  .extend({ status: z.enum(['issued', 'cancelled']).optional() });
const listInvoicesSchema = z.object({
  client_id: z.coerce.number().int().positive().optional(),
  state: z.enum(['due', 'partial', 'overdue', 'paid', 'cancelled']).optional(),
  from: dateStr.optional(),
  to: dateStr.optional(),
});
const paymentSchema = z.object({
  amount: z.coerce.number().positive('টাকার পরিমাণ দিন'),
  paid_on: dateStr,
  method: z.string().max(40).nullable().optional(),
  reference: z.string().max(120).nullable().optional(),
});
const expenseSchema = z.object({
  expense_date: dateStr,
  category: z.enum(AGENCY_EXPENSE_CATEGORIES).default('other'),
  amount: z.coerce.number().positive('টাকার পরিমাণ দিন'),
  note: z.string().max(500).nullable().optional(),
});

const audit = (req, action, entityType, entityId, meta) =>
  logActivity({ userId: req.user.id, action, entityType, entityId, meta, ip: req.ip });

// ---- invoices
router.get(
  '/invoices',
  authorize(...FINANCE_ROLES),
  validate(listInvoicesSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { rows, meta } = await service.listInvoices(await getScope(req), req.validatedQuery);
    ok(res, rows, meta);
  }),
);

router.get(
  '/invoices/:id',
  authorize(...FINANCE_ROLES),
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => ok(res, await service.getInvoice(req.params.id, await getScope(req)))),
);

router.post(
  '/invoices',
  authorize(...FINANCE_ROLES),
  validate(invoiceSchema),
  guardClient((req) => req.body.client_id),
  asyncHandler(async (req, res) => {
    const invoice = await service.createInvoice(req.body, req.user.id);
    await audit(req, 'create', 'invoice', invoice.id, { client_id: invoice.client_id, total: invoice.total });
    await notifyUsers(await clientUserIds(invoice.client_id), {
      type: 'invoice_issued',
      data: { invoice_no: invoice.invoice_no, total: invoice.total, due_date: invoice.due_date },
      link: 'business:accounting',
      clientId: invoice.client_id,
      email: {
        subject: `Invoice ${invoice.invoice_no} from Rainfall Media`,
        text: `A new invoice ${invoice.invoice_no} for BDT ${invoice.total} has been issued, due on ${invoice.due_date}.\n\nView it in your dashboard: ${config.jobs.appUrl}/business/accounting`,
      },
    });
    created(res, invoice);
  }),
);

router.patch(
  '/invoices/:id',
  authorize(...FINANCE_ROLES),
  validate(idParam, 'params'),
  validate(updateInvoiceSchema),
  asyncHandler(async (req, res) => {
    const invoice = await service.updateInvoice(req.params.id, req.body, await getScope(req));
    await audit(req, req.body.status === 'cancelled' ? 'cancel' : 'update', 'invoice', invoice.id, { changes: req.body });
    ok(res, invoice);
  }),
);

router.post(
  '/invoices/:id/payments',
  authorize(...FINANCE_ROLES),
  validate(idParam, 'params'),
  validate(paymentSchema),
  asyncHandler(async (req, res) => {
    const invoice = await service.addPayment(req.params.id, req.body, req.user.id, await getScope(req));
    await audit(req, 'payment', 'invoice', invoice.id, { amount: req.body.amount, paid_on: req.body.paid_on });
    const data = { invoice_no: invoice.invoice_no, client: invoice.client_name, amount: req.body.amount };
    await notifyUsers([...(await adminIds()), ...(await clientStaffIds(invoice.client_id))], {
      type: 'payment_received',
      data,
      link: '/finance',
      clientId: invoice.client_id,
    });
    await notifyUsers(await clientUserIds(invoice.client_id), {
      type: 'payment_received',
      data,
      link: 'business:accounting',
      clientId: invoice.client_id,
    });
    created(res, invoice);
  }),
);

router.delete(
  '/payments/:id',
  adminOnly,
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const payment = await service.removePayment(req.params.id, await getScope(req));
    await audit(req, 'delete_payment', 'invoice', payment.invoice_id, { payment_id: payment.id, amount: payment.amount });
    noContent(res);
  }),
);

// ---- agency expenses & P&L (agency-internal, admin only)
router.get(
  '/expenses',
  adminOnly,
  validate(z.object({ from: dateStr.optional(), to: dateStr.optional() }), 'query'),
  asyncHandler(async (req, res) => ok(res, await service.listAgencyExpenses(req.validatedQuery))),
);

router.post(
  '/expenses',
  adminOnly,
  validate(expenseSchema),
  asyncHandler(async (req, res) => {
    const expense = await service.createAgencyExpense(req.body, req.user.id);
    await audit(req, 'create', 'agency_expense', expense.id, { amount: expense.amount, category: expense.category });
    created(res, expense);
  }),
);

router.delete(
  '/expenses/:id',
  adminOnly,
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const expense = await service.removeAgencyExpense(req.params.id);
    await audit(req, 'delete', 'agency_expense', req.params.id, { amount: expense.amount, category: expense.category });
    noContent(res);
  }),
);

router.get(
  '/pnl',
  adminOnly,
  validate(yearQuery, 'query'),
  asyncHandler(async (req, res) => ok(res, await service.agencyPnl(req.validatedQuery.year))),
);

router.get(
  '/export/pnl.xlsx',
  adminOnly,
  validate(yearQuery, 'query'),
  asyncHandler(async (req, res) => {
    const { year } = req.validatedQuery;
    const [pnl, invoices, expenses] = await Promise.all([
      service.agencyPnl(year),
      service.listInvoices(null, { from: `${year}-01-01`, to: `${year}-12-31` }),
      service.listAgencyExpenses({ from: `${year}-01-01`, to: `${year}-12-31` }),
    ]);
    await audit(req, 'export', 'agency_pnl', year);
    await sendWorkbook(res, `rainfall-agency-${year}.xlsx`, agencyPnlWorkbook(pnl, invoices.rows, expenses));
  }),
);

export default router;
