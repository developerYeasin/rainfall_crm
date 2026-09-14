import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.js';
import { authorize } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created, noContent } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import { logActivity } from '../../utils/activity.js';
import { ROLES, BUSINESS_WRITE_ROLES } from '../../config/constants.js';
import { businessService as service } from './business.service.js';
import {
  rangeSchema,
  productSchema,
  updateProductSchema,
  purchaseSchema,
  orderSchema,
  updateOrderSchema,
  listOrdersSchema,
  expenseSchema,
  updateExpenseSchema,
  listExpensesSchema,
  idParamSchema,
} from './business.validation.js';

const router = Router();

const clientQuerySchema = z.object({ client_id: z.coerce.number().int().positive() });

/**
 * Pins every request to one client. A client login is ALWAYS locked to its own
 * client_id (anything passed in the query is ignored); staff pick via ?client_id=.
 */
const resolveClient = asyncHandler(async (req, res, next) => {
  if (req.user.role === ROLES.CLIENT) {
    if (!req.user.client_id) throw ApiError.forbidden('এই অ্যাকাউন্টে কোনো ক্লায়েন্ট যুক্ত নেই');
    req.clientId = req.user.client_id;
  } else {
    const parsed = clientQuerySchema.safeParse(req.query);
    if (!parsed.success) throw ApiError.badRequest('client_id দিন');
    req.clientId = parsed.data.client_id;
  }
  await service.resolveClient(req.clientId);
  next();
});

const canWrite = authorize(...BUSINESS_WRITE_ROLES);

const audit = (req, action, entityType, entityId) =>
  logActivity({ userId: req.user.id, action, entityType, entityId, meta: { client_id: req.clientId }, ip: req.ip });

router.use(resolveClient);

router.get('/profile', asyncHandler(async (req, res) => ok(res, await service.resolveClient(req.clientId))));
router.get(
  '/summary',
  validate(rangeSchema, 'query'),
  asyncHandler(async (req, res) => ok(res, await service.summary(req.clientId, req.validatedQuery))),
);

// Products & stock
router.get('/products', asyncHandler(async (req, res) => ok(res, await service.listProducts(req.clientId))));
router.post(
  '/products',
  canWrite,
  validate(productSchema),
  asyncHandler(async (req, res) => {
    const product = await service.createProduct(req.clientId, req.body, req.user.id);
    await audit(req, 'create', 'product', product.id);
    created(res, product);
  }),
);
router.patch(
  '/products/:id',
  canWrite,
  validate(idParamSchema, 'params'),
  validate(updateProductSchema),
  asyncHandler(async (req, res) => {
    const product = await service.updateProduct(req.clientId, req.params.id, req.body);
    await audit(req, 'update', 'product', product.id);
    ok(res, product);
  }),
);
router.delete(
  '/products/:id',
  canWrite,
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    await service.removeProduct(req.clientId, req.params.id);
    await audit(req, 'delete', 'product', req.params.id);
    noContent(res);
  }),
);

router.get(
  '/purchases',
  validate(rangeSchema, 'query'),
  asyncHandler(async (req, res) => ok(res, await service.listPurchases(req.clientId, req.validatedQuery))),
);
router.post(
  '/purchases',
  canWrite,
  validate(purchaseSchema),
  asyncHandler(async (req, res) => {
    const purchase = await service.createPurchase(req.clientId, req.body, req.user.id);
    await audit(req, 'create', 'stock_purchase', purchase.id);
    created(res, purchase);
  }),
);
router.delete(
  '/purchases/:id',
  canWrite,
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    await service.removePurchase(req.clientId, req.params.id);
    await audit(req, 'delete', 'stock_purchase', req.params.id);
    noContent(res);
  }),
);

// Orders: sales and pre-orders
router.get(
  '/orders',
  validate(listOrdersSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { rows, meta } = await service.listOrders(req.clientId, req.validatedQuery);
    ok(res, rows, meta);
  }),
);
router.post(
  '/orders',
  canWrite,
  validate(orderSchema),
  asyncHandler(async (req, res) => {
    const order = await service.createOrder(req.clientId, req.body, req.user.id);
    await audit(req, 'create', 'order', order.id);
    created(res, order);
  }),
);
router.patch(
  '/orders/:id',
  canWrite,
  validate(idParamSchema, 'params'),
  validate(updateOrderSchema),
  asyncHandler(async (req, res) => {
    const order = await service.updateOrder(req.clientId, req.params.id, req.body);
    await audit(req, 'update', 'order', order.id);
    ok(res, order);
  }),
);
router.delete(
  '/orders/:id',
  canWrite,
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    await service.removeOrder(req.clientId, req.params.id);
    await audit(req, 'delete', 'order', req.params.id);
    noContent(res);
  }),
);

// Expenses
router.get(
  '/expenses',
  validate(listExpensesSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { rows, meta } = await service.listExpenses(req.clientId, req.validatedQuery);
    ok(res, rows, meta);
  }),
);
router.post(
  '/expenses',
  canWrite,
  validate(expenseSchema),
  asyncHandler(async (req, res) => {
    const expense = await service.createExpense(req.clientId, req.body, req.user.id);
    await audit(req, 'create', 'expense', expense.id);
    created(res, expense);
  }),
);
router.patch(
  '/expenses/:id',
  canWrite,
  validate(idParamSchema, 'params'),
  validate(updateExpenseSchema),
  asyncHandler(async (req, res) => {
    const expense = await service.updateExpense(req.clientId, req.params.id, req.body);
    await audit(req, 'update', 'expense', expense.id);
    ok(res, expense);
  }),
);
router.delete(
  '/expenses/:id',
  canWrite,
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    await service.removeExpense(req.clientId, req.params.id);
    await audit(req, 'delete', 'expense', req.params.id);
    noContent(res);
  }),
);

export default router;
