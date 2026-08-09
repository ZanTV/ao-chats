import { z } from 'zod';

const emailField = z
  .string({ required_error: 'Email is required' })
  .trim()
  .toLowerCase()
  .email('Invalid email address');

export const registerSchema = z.object({
  firstName: z
    .string({ required_error: 'First name is required' })
    .trim()
    .min(2, 'First name must be at least 2 characters')
    .max(50),
  lastName: z
    .string({ required_error: 'Last name is required' })
    .trim()
    .min(2, 'Last name must be at least 2 characters')
    .max(50),
  username: z
    .string({ required_error: 'Username is required' })
    .trim()
    .toLowerCase()
    .min(3, 'Username must be at least 3 characters')
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: emailField,
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
  university: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : 'Other')),
  course: z
    .union([z.string().trim().max(100), z.literal(''), z.null(), z.undefined()])
    .optional()
    .transform((v) => (v && String(v).trim().length > 0 ? String(v).trim() : undefined)),
  avatarId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : 'avatar-1')),
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
  email: emailField,
  code: z
    .string({ required_error: 'Verification code is required' })
    .trim()
    .length(6, 'Verification code must be 6 digits'),
});

export const loginSchema = z.object({
  email: emailField,
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export const resetPasswordSchema = z
  .object({
    email: emailField,
    code: z
      .string({ required_error: 'Verification code is required' })
      .trim()
      .length(6, 'Verification code must be 6 digits'),
    newPassword: z
      .string({ required_error: 'Password is required' })
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain an uppercase letter')
      .regex(/[a-z]/, 'Password must contain a lowercase letter')
      .regex(/[0-9]/, 'Password must contain a number'),
    confirmPassword: z.string({ required_error: 'Please confirm your password' }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const refreshTokenSchema = z.object({
  refreshToken: z.string({ required_error: 'Refresh token is required' }).min(1),
});

export const searchUsersSchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().min(1).max(50).optional(),
});

const attachmentSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(['image', 'video', 'document']),
  mimeType: z.string().min(3).max(120),
  fileName: z.string().min(1).max(180),
  fileSize: z.number().int().positive().max(50 * 1024 * 1024),
  storageKey: z.string().min(1).max(400),
  url: z.string().min(1).max(1000),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  duration: z.number().nonnegative().optional(),
});

export const sendMessageSchema = z
  .object({
    content: z.string().max(5000).optional().default(''),
    type: z.enum(['TEXT', 'IMAGE', 'FILE']).optional(),
    replyToId: z.string().uuid().optional(),
    tempId: z.string().max(64).optional(),
    attachment: attachmentSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const hasAttachment = Boolean(data.attachment);
    const text = (data.content ?? '').trim();
    if (!hasAttachment && !text) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Message content is required',
        path: ['content'],
      });
    }
    if (hasAttachment && data.type === 'TEXT') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Attachment messages must use IMAGE or FILE type',
        path: ['type'],
      });
    }
  });

export const editMessageSchema = z.object({
  content: z.string().min(1).max(5000),
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

/** Build a single user-facing message from Zod field errors. */
export function formatValidationErrors(
  fieldErrors: Record<string, string[] | undefined>
): string {
  for (const [field, messages] of Object.entries(fieldErrors)) {
    const msg = messages?.[0];
    if (msg) {
      const label = field.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
      if (/required/i.test(msg) || /expected string/i.test(msg)) {
        return `${label} is required`;
      }
      return msg;
    }
  }
  return 'Please check your registration details and try again';
}
