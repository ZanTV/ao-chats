import dotenv from 'dotenv';
dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

if (isProduction && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production');
}

if (
  isProduction &&
  process.env.JWT_SECRET === 'your-super-secret-jwt-key-change-in-production'
) {
  throw new Error('JWT_SECRET must be changed from the default value in production');
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv,
  isProduction,
  databaseUrl: process.env.DATABASE_URL!,
  redisUrl: process.env.REDIS_URL || (isProduction ? '' : 'redis://localhost:6379'),
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'AO Chats <noreply@aochats.com>',
  },
  clientUrl: process.env.CLIENT_URL || 'https://www.aochats.chat',
  corsOrigin: process.env.CORS_ORIGIN || process.env.CLIENT_URL || (isProduction ? 'https://www.aochats.chat' : '*'),
  socketCorsOrigin:
    process.env.SOCKET_CORS_ORIGIN ||
    process.env.CORS_ORIGIN ||
    process.env.CLIENT_URL ||
    (isProduction ? 'https://www.aochats.chat' : '*'),
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || (isProduction ? '200' : '100'), 10),
  },
  maxPinnedMessages: 20,
  verifyCodeExpiryMs: parseInt(process.env.VERIFY_CODE_EXPIRY_MINUTES || '5', 10) * 60 * 1000,
  resendCodeCooldownMs: 60 * 1000,
};

export function isEmailConfigured(): boolean {
  return !!(config.smtp.user && config.smtp.pass);
}

export const UNIVERSITIES = [
  'University of Nairobi',
  'Kenyatta University',
  'Strathmore University',
  'United States International University',
  'Jomo Kenyatta University of Agriculture and Technology',
  'Moi University',
  'Egerton University',
  'Maseno University',
  'Technical University of Kenya',
  'Dedan Kimathi University of Technology',
  'Other',
];

export const AVATAR_CATEGORIES = {
  animals: ['avatar-1', 'avatar-2', 'avatar-3', 'avatar-4', 'avatar-5'],
  nature: ['avatar-6', 'avatar-7', 'avatar-8', 'avatar-9', 'avatar-10'],
  technology: ['avatar-11', 'avatar-12', 'avatar-13', 'avatar-14', 'avatar-15'],
  sports: ['avatar-16', 'avatar-17', 'avatar-18', 'avatar-19', 'avatar-20'],
  education: ['avatar-21', 'avatar-22', 'avatar-23', 'avatar-24', 'avatar-25'],
  minimal: ['avatar-26', 'avatar-27', 'avatar-28', 'avatar-29', 'avatar-30'],
};

export const ALL_AVATARS = Object.values(AVATAR_CATEGORIES).flat();

export const AO_MANAGER = {
  username: 'ao-manager',
  email: 'support@aochats.com',
  firstName: 'AO',
  lastName: 'Manager',
  avatarId: 'avatar-30',
  bio: 'Official AO Chats Support',
  statusMessage: 'Official AO Chats Support',
};
