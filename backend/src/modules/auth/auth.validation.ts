import { z } from 'zod';

export const registerSchema = z.object({
  firstName: z.string().trim().min(2, 'First name must be at least 2 characters').max(50),
  lastName: z.string().trim().min(2, 'Last name must be at least 2 characters').max(50),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: z.string().trim().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
  university: z.string().min(1, 'University is required'),
  course: z.string().max(100).optional(),
  avatarId: z.string().min(1, 'Avatar is required'),
});

export const registerStep1Schema = registerSchema.pick({
  firstName: true,
  lastName: true,
  username: true,
});

export const registerStep2Schema = registerSchema.pick({
  email: true,
  password: true,
});

export const registerStep3Schema = registerSchema.pick({
  university: true,
  course: true,
});

export const registerStep4Schema = registerSchema.pick({
  avatarId: true,
});

export const verifyEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  newPassword: z.string().min(8),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const searchUsersSchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().min(1).max(50).optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(5000),
  type: z.enum(['TEXT', 'IMAGE', 'FILE']).optional(),
  replyToId: z.string().uuid().optional(),
  tempId: z.string().max(64).optional(),
});

export const reactMessageSchema = z.object({
  emoji: z.string().min(1).max(10),
});

export const pinMessageSchema = z.object({
  messageId: z.string().uuid(),
});

export const forwardMessageSchema = z.object({
  conversationId: z.string().uuid(),
});
