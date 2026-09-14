import { z } from 'zod';
import { ALL_ROLES } from '../../config/constants.js';

export const loginSchema = z.object({
  email: z.string().email('সঠিক ইমেইল দিন'),
  password: z.string().min(6, 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষর'),
});

export const registerSchema = z
  .object({
    name: z.string().min(2).max(120),
    email: z.string().email(),
    password: z.string().min(6).max(72),
    role: z.enum(ALL_ROLES).default('viewer'),
    phone: z.string().max(40).optional().nullable(),
    client_id: z.coerce.number().int().positive().optional().nullable(),
  })
  .refine((data) => data.role !== 'client' || data.client_id, {
    message: 'ক্লায়েন্ট অ্যাকাউন্টের জন্য ক্লায়েন্ট বেছে নিন',
    path: ['client_id'],
  });

export const refreshSchema = z.object({ refreshToken: z.string().min(10) });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6).max(72),
});
