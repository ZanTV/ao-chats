import { z } from 'zod';

const e164Regex = /^\+[1-9]\d{6,14}$/;

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(2).max(50).optional(),
  lastName: z.string().trim().min(2).max(50).optional(),
  username: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .optional(),
  bio: z.string().max(200).optional(),
  university: z.string().max(100).optional(),
  course: z.string().max(100).optional(),
  avatarId: z.string().optional(),
  statusMessage: z.string().max(100).optional(),
  mobileNumber: z
    .union([
      z.string().regex(e164Regex, 'Use international format e.g. +254712345678'),
      z.literal(''),
      z.null(),
    ])
    .optional(),
});

export function normalizeMobileNumber(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value.trim() === '') return null;
  const cleaned = value.trim().replace(/[\s\-().]/g, '');
  if (!e164Regex.test(cleaned)) {
    return null;
  }
  return cleaned;
}
