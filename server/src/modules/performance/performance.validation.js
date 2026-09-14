import { z } from 'zod';
import { PLATFORMS } from '../../config/constants.js';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'তারিখ YYYY-MM-DD ফরম্যাটে দিন');

export const createEntrySchema = z.object({
  cycle_id: z.coerce.number().int().positive(),
  entry_date: dateStr,
  week_no: z.coerce.number().int().min(1).max(6).optional(),
  platform: z.enum(PLATFORMS).default('Facebook'),
  spend: z.coerce.number().min(0).default(0),
  impressions: z.coerce.number().int().min(0).default(0),
  clicks: z.coerce.number().int().min(0).default(0),
  conversions: z.coerce.number().int().min(0).default(0),
  revenue: z.coerce.number().min(0).default(0),
  note: z.string().max(500).nullable().optional(),
});

export const updateEntrySchema = createEntrySchema.partial().omit({ cycle_id: true });

export const listEntriesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  cycle_id: z.coerce.number().int().positive(),
  week_no: z.coerce.number().int().min(1).max(6).optional(),
  platform: z.enum(PLATFORMS).optional(),
  from: dateStr.optional(),
  to: dateStr.optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
});

export const bulkEntriesSchema = z.object({
  cycle_id: z.coerce.number().int().positive(),
  rows: z.array(createEntrySchema.omit({ cycle_id: true })).min(1).max(200),
});

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
