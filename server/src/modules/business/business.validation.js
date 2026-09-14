import { z } from 'zod';
import { ORDER_STATUS, EXPENSE_CATEGORIES } from '../../config/constants.js';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'তারিখ YYYY-MM-DD ফরম্যাটে দিন');
const money = z.coerce.number().min(0);
const count = z.coerce.number().int().min(0);
const nullableString = (max) => z.string().max(max).nullable().optional();

export const rangeSchema = z.object({
  from: dateStr.optional(),
  to: dateStr.optional(),
});

export const productSchema = z.object({
  name: z.string().trim().min(1, 'প্রোডাক্টের নাম দিন').max(160),
  sku: nullableString(60),
  category: nullableString(80),
  cost_price: money.default(0),
  sale_price: money.default(0),
  opening_stock: count.default(0),
  low_stock_alert: count.default(5),
  is_active: z.boolean().optional(),
});
export const updateProductSchema = productSchema.partial();

export const purchaseSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  purchase_date: dateStr,
  qty: z.coerce.number().int().positive('পরিমাণ ১ বা বেশি'),
  unit_cost: money.optional(),
  supplier: nullableString(160),
  note: nullableString(500),
});

export const orderSchema = z.object({
  product_id: z.coerce.number().int().positive('প্রোডাক্ট বেছে নিন'),
  order_date: dateStr,
  status: z.enum(ORDER_STATUS).default('confirmed'),
  qty: z.coerce.number().int().positive('পরিমাণ ১ বা বেশি'),
  unit_price: money.optional(),
  discount: money.default(0),
  paid_amount: money.default(0),
  customer_name: nullableString(120),
  customer_phone: nullableString(40),
  note: nullableString(500),
});
export const updateOrderSchema = orderSchema.partial();

export const listOrdersSchema = rangeSchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  status: z.enum(ORDER_STATUS).optional(),
  product_id: z.coerce.number().int().positive().optional(),
  search: z.string().trim().optional(),
});

export const expenseSchema = z.object({
  expense_date: dateStr,
  category: z.enum(EXPENSE_CATEGORIES).default('other'),
  amount: z.coerce.number().positive('টাকার পরিমাণ দিন'),
  note: nullableString(500),
});
export const updateExpenseSchema = expenseSchema.partial();

export const listExpensesSchema = rangeSchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  category: z.enum(EXPENSE_CATEGORIES).optional(),
});

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
