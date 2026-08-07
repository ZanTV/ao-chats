import './loadEnv';
import {
  formatValidationError,
  validateEnvironment,
  type EnvValidationResult,
} from './validate';
import { currentNodeEnv, loadedEnvFile } from './loadEnv';

const nodeEnv = currentNodeEnv;
const isProduction = nodeEnv === 'production';

const validation = validateEnvironment(nodeEnv, loadedEnvFile);
if (!validation.valid) {
  throw new Error(formatValidationError(validation));
}

function env(name: string, fallback?: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable: ${name}`);
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw?.trim()) return fallback;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a number (got: ${raw})`);
  }
  return parsed;
}

const port = envInt('PORT', 3001);

export const config = {
  port,
  nodeEnv,
  isProduction,
  databaseUrl: isProduction
    ? env('DATABASE_URL')
    : env('DATABASE_URL', 'postgresql://localhost:5432/aochats'),
  redisUrl: isProduction
    ? env('REDIS_URL')
    : env('REDIS_URL', 'redis://localhost:6379'),
  apiUrl: isProduction ? env('API_URL') : env('API_URL', `http://localhost:${port}`),
  socketUrl: isProduction ? env('SOCKET_URL') : env('SOCKET_URL', `http://localhost:${port}`),
  jwt: {
    secret: isProduction ? env('JWT_SECRET') : env('JWT_SECRET', 'dev-secret-change-me'),
    refreshSecret: isProduction
      ? env('JWT_REFRESH_SECRET')
      : env('JWT_REFRESH_SECRET', env('JWT_SECRET', 'dev-secret-change-me')),
    expiresIn: env('JWT_EXPIRES_IN', '7d'),
    refreshExpiresIn: env('JWT_REFRESH_EXPIRES_IN', '30d'),
  },
  smtp: {
    host: isProduction ? env('SMTP_HOST') : env('SMTP_HOST', 'smtp.gmail.com'),
    port: envInt('SMTP_PORT', 587),
    user: isProduction ? env('SMTP_USER') : env('SMTP_USER', ''),
    pass: isProduction ? env('SMTP_PASS') : env('SMTP_PASS', ''),
    from: env('EMAIL_FROM', 'AO Chats <noreply@aochats.com>'),
  },
  objectStorage: {
    endpoint: process.env.OBJECT_STORAGE_ENDPOINT?.trim() || '',
    bucket: process.env.OBJECT_STORAGE_BUCKET?.trim() || '',
  },
  clientUrl: isProduction
    ? env('CLIENT_URL')
    : env('CLIENT_URL', 'http://localhost:8081'),
  corsOrigin:
    process.env.CORS_ORIGIN?.trim() ||
    process.env.CLIENT_URL?.trim() ||
    (isProduction ? env('CLIENT_URL') : '*'),
  socketCorsOrigin:
    process.env.SOCKET_CORS_ORIGIN?.trim() ||
    process.env.CORS_ORIGIN?.trim() ||
    process.env.CLIENT_URL?.trim() ||
    (isProduction ? env('CLIENT_URL') : '*'),
  rateLimit: {
    windowMs: envInt('RATE_LIMIT_WINDOW_MS', 900_000),
    max: envInt('RATE_LIMIT_MAX', isProduction ? 1000 : 500),
  },
  maxPinnedMessages: 20,
  verifyCodeExpiryMs: envInt('VERIFY_CODE_EXPIRY_MINUTES', 5) * 60 * 1000,
  resendCodeCooldownMs: 60 * 1000,
};

export function isEmailConfigured(): boolean {
  return !!(config.smtp.user && config.smtp.pass);
}

export function getEnvironmentValidation(): EnvValidationResult {
  return validateEnvironment(nodeEnv, loadedEnvFile);
}

export { loadedEnvFile, validation };

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
