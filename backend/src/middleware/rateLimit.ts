import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { Request } from 'express';
import { config } from '../config';

function rateLimitKey(req: Request): string {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    try {
      const token = auth.split(' ')[1];
      const decoded = jwt.decode(token) as { userId?: string } | null;
      if (decoded?.userId) return `user:${decoded.userId}`;
    } catch {
      // fall through to IP
    }
  }
  return req.ip || 'anonymous';
}

/** Strict limit for login/register — keyed by IP */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.isProduction ? 30 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, please try again later' },
});

/** General API limit — keyed by user when authenticated */
export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  message: { error: 'Too many requests, please try again later' },
});
