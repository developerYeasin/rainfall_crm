import { z } from 'zod';
import { CYCLE_STATUS } from '../../config/constants.js';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'তারিখ YYYY-MM-DD ফরম্যাটে দিন');

export const createCycleSchema = z.object({
  client_id: z.coerce.number().int().positive(),
  name: z.string().min(1).max(120).default('মাস ১'),
  month_start: dateStr,
  weeks_count: z.coerce.number().int().min(1).max(6).default(4),
  status: z.enum(CYCLE_STATUS).default('running'),
  monthly_budget: z.coerce.number().min(0).default(60000),
  expected_ctr: z.coerce.number().min(0).max(1).default(0.02),
  expected_cpc: z.coerce.number().min(0).default(3.5),
  expected_conversion_rate: z.coerce.number().min(0).max(1).default(0.02),
  aov: z.coerce.number().min(0).default(900),
});

export const updateCycleSchema = createCycleSchema.partial().omit({ client_id: true });

export const listCyclesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  client_id: z.coerce.number().int().positive().optional(),
  status: z.enum(CYCLE_STATUS).optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export const updateWeekSchema = z.object({
  budget: z.coerce.number().min(0).optional(),
  label: z.string().min(1).max(60).optional(),
  start_date: dateStr.nullable().optional(),
  end_date: dateStr.nullable().optional(),
});

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
export const weekParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  weekNo: z.coerce.number().int().min(1).max(6),
});
