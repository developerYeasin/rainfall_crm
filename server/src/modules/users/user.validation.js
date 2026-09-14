import { z } from 'zod';
import { ALL_ROLES } from '../../config/constants.js';

export const listUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
  search: z.string().trim().optional(),
  role: z.enum(ALL_ROLES).optional(),
  is_active: z.enum(['0', '1']).optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  role: z.enum(ALL_ROLES).optional(),
  phone: z.string().max(40).nullable().optional(),
  is_active: z.boolean().optional(),
  password: z.string().min(6).max(72).optional(),
  client_id: z.coerce.number().int().positive().nullable().optional(),
});

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
