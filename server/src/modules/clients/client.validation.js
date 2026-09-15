import { z } from 'zod';
import { CLIENT_STATUS } from '../../config/constants.js';

const nullableString = (max) => z.string().max(max).nullable().optional();

export const createClientSchema = z.object({
  name: z.string().min(2, 'ক্লায়েন্টের নাম দিন').max(160),
  company: nullableString(160),
  contact_person: nullableString(120),
  email: z.string().email().nullable().optional().or(z.literal('')),
  phone: nullableString(40),
  industry: nullableString(120),
  status: z.enum(CLIENT_STATUS).default('onboarding'),
  onboarded_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  monthly_retainer: z.coerce.number().min(0).nullable().optional(),
  account_manager_id: z.coerce.number().int().positive().nullable().optional(),
  notes: nullableString(5000),
});

export const updateClientSchema = createClientSchema.partial();

/** Portal login issued together with a new client (defaults to the client's own email). */
export const createClientWithLoginSchema = createClientSchema.extend({
  create_login: z.boolean().default(true),
  login_email: z.string().email('সঠিক লগইন ইমেইল দিন').nullable().optional().or(z.literal('')),
});

export const clientLoginSchema = z.object({ email: z.string().email('সঠিক ইমেইল দিন').optional() });

export const listClientsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
  search: z.string().trim().optional(),
  status: z.enum(CLIENT_STATUS).optional(),
  account_manager_id: z.coerce.number().int().positive().optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
