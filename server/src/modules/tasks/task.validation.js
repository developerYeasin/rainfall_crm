import { z } from 'zod';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'তারিখ YYYY-MM-DD ফরম্যাটে দিন');

export const createTaskSchema = z.object({
  cycle_id: z.coerce.number().int().positive(),
  task_date: dateStr,
  task_name: z.string().min(2, 'টাস্কের নাম দিন').max(160),
  owner_label: z.string().max(120).nullable().optional(),
  assignee_id: z.coerce.number().int().positive().nullable().optional(),
  morning_check: z.coerce.boolean().default(false),
  ad_monitoring_done: z.coerce.boolean().default(false),
  report_updated: z.coerce.boolean().default(false),
  client_update_sent: z.coerce.boolean().default(false),
  comment: z.string().max(500).nullable().optional(),
});

export const updateTaskSchema = createTaskSchema.partial().omit({ cycle_id: true });

export const listTasksSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  cycle_id: z.coerce.number().int().positive(),
  assignee_id: z.coerce.number().int().positive().optional(),
  from: dateStr.optional(),
  to: dateStr.optional(),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
});

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
