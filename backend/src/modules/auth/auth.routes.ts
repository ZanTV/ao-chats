import { Router } from 'express';
import { authService } from './auth.service';
import {
  registerSchema,
  verifyEmailSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  formatValidationErrors,
} from './auth.validation';
import { validateBody } from '../../middleware/validation';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { UNIVERSITIES, UNIVERSITY_OPTIONS, AVATAR_CATEGORIES } from '../../config';
import { cacheGetVersioned, cacheSetVersioned, CacheKeys, CacheTTL } from '../../config/redis';
import { paramId } from '../../utils/params';

const router = Router();

router.get('/universities', async (_req, res) => {
  const cached = await cacheGetVersioned<string[]>(CacheKeys.universities);
  if (cached?.data) {
    res.json({
      universities: cached.data,
      options: UNIVERSITY_OPTIONS,
      cacheVersion: cached.version,
    });
    return;
  }
  const cacheVersion = await cacheSetVersioned(CacheKeys.universities, UNIVERSITIES, CacheTTL.static);
  res.json({ universities: UNIVERSITIES, options: UNIVERSITY_OPTIONS, cacheVersion });
});

router.get('/avatars', async (_req, res) => {
  const cached = await cacheGetVersioned<Record<string, string[]>>(CacheKeys.avatars);
  if (cached?.data) {
    res.json({ categories: cached.data, cacheVersion: cached.version });
    return;
  }
  const cacheVersion = await cacheSetVersioned(CacheKeys.avatars, AVATAR_CATEGORIES, CacheTTL.static);
  res.json({ categories: AVATAR_CATEGORIES, cacheVersion });
});

router.get(
  '/check-username/:username',
  asyncHandler(async (req, res) => {
    const result = await authService.checkUsernameAvailable(paramId(req.params.username));
    res.json(result);
  })
);

router.post(
  '/check-password-strength',
  asyncHandler(async (req, res) => {
    const { password } = req.body;
    if (!password) {
      res.status(400).json({ error: 'Password required' });
      return;
    }
    res.json(authService.checkPasswordStrength(password));
  })
);

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      res.status(400).json({
        error: formatValidationErrors(fieldErrors),
        code: 'VALIDATION_ERROR',
        details: fieldErrors,
      });
      return;
    }

    const result = await authService.register(parsed.data);
    res.status(201).json(result);
  })
);

router.post(
  '/verify-email',
  validateBody(verifyEmailSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.verifyEmail(req.body.email, req.body.code);
    res.json(result);
  })
);

router.post(
  '/resend-verification',
  validateBody(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.resendVerification(req.body.email);
    res.json(result);
  })
);

router.post(
  '/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.login(
      req.body.email,
      req.body.password,
      req.headers['user-agent'],
      req.ip
    );
    res.json(result);
  })
);

router.post(
  '/refresh',
  validateBody(refreshTokenSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.refreshAccessToken(req.body.refreshToken);
    res.json(result);
  })
);

router.post(
  '/logout',
  validateBody(refreshTokenSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.logout(req.body.refreshToken);
    res.json(result);
  })
);

router.post(
  '/logout-all',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await authService.logoutAll(req.userId!);
    res.json(result);
  })
);

router.post(
  '/forgot-password',
  validateBody(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.forgotPassword(req.body.email);
    res.json(result);
  })
);

router.post(
  '/reset-password',
  validateBody(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.resetPassword(
      req.body.email,
      req.body.code,
      req.body.newPassword
    );
    res.json(result);
  })
);

export default router;
