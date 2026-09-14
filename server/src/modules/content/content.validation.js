import { z } from 'zod';
import { PLATFORMS, CONTENT_TYPES, CONTENT_STATUS } from '../../config/constants.js';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'তারিখ YYYY-MM-DD ফরম্যাটে দিন');

export const createContentSchema = z.object({
  cycle_id: z.coerce.number().int().positive(),
  plan_date: dateStr,
  platform: z.enum(PLATFORMS).default('Facebook'),
  content_type: z.enum(CONTENT_TYPES),
  topic: z.string().min(2, 'টপিক/ক্যাপশন আইডিয়া দিন').max(300),
  status: z.enum(CONTENT_STATUS).default('আইডিয়া'),
  designer_id: z.coerce.number().int().positive().nullable().optional(),
  designer_name: z.string().max(120).nullable().optional(),
  publish_date: dateStr.nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

export const updateContentSchema = createContentSchema.partial().omit({ cycle_id: true });

export const listContentSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  cycle_id: z.coerce.number().int().positive(),
  status: z.enum(CONTENT_STATUS).optional(),
  platform: z.enum(PLATFORMS).optional(),
  from: dateStr.optional(),
  to: dateStr.optional(),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
});

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
