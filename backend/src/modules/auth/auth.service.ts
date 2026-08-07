import { prisma } from '../../config/database';
import {
  generateAccessToken,
  generateRefreshToken,
  hashPassword,
  comparePassword,
  generateVerificationCode,
  parseExpiresIn,
  getPasswordStrength,
} from '../../utils/auth.utils';
import { sendVerificationEmail, sendPasswordResetEmail } from '../../utils/email.utils';
import { config, ALL_AVATARS } from '../../config';
import { AppError } from '../../middleware/errorHandler';

const userPublicSelect = {
  id: true,
  email: true,
  emailVerified: true,
  username: true,
  firstName: true,
  lastName: true,
  avatarId: true,
  university: true,
  course: true,
  bio: true,
};

function getVerifyExpiry(): Date {
  return new Date(Date.now() + config.verifyCodeExpiryMs);
}

function normalizeCode(code: string): string {
  return code.trim().replace(/\s/g, '');
}

export class AuthService {
  async register(data: {
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    password: string;
    university?: string;
    course?: string;
    avatarId?: string;
  }) {
    const existingEmail = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingEmail) throw new AppError(409, 'Email already registered');

    const existingUsername = await prisma.user.findUnique({ where: { username: data.username } });
    if (existingUsername) throw new AppError(409, 'Username already taken');

    if (data.avatarId && !ALL_AVATARS.includes(data.avatarId)) {
      throw new AppError(400, 'Invalid avatar selection');
    }

    const passwordHash = await hashPassword(data.password);
    const verifyCode = generateVerificationCode();
    const verifyExpiry = getVerifyExpiry();

    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        username: data.username.toLowerCase(),
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        university: data.university,
        course: data.course,
        avatarId: data.avatarId || 'avatar-1',
        emailVerifyCode: verifyCode,
        emailVerifyExpiry: verifyExpiry,
      },
      select: userPublicSelect,
    });

    try {
      await sendVerificationEmail(user.email, verifyCode, user.firstName);
    } catch (err) {
      await prisma.user.delete({ where: { id: user.id } });
      const message = err instanceof Error ? err.message : 'Failed to send verification email';
      throw new AppError(502, message, 'EMAIL_SEND_FAILED');
    }

    return {
      user,
      message: 'Verification code sent to your email.',
      expiresInMinutes: Math.round(config.verifyCodeExpiryMs / 60000),
    };
  }

  async verifyEmail(email: string, code: string) {
    const normalizedCode = normalizeCode(code);
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) throw new AppError(404, 'User not found');
    if (user.emailVerified) throw new AppError(400, 'Email already verified');

    if (user.emailVerifyExpiry && user.emailVerifyExpiry < new Date()) {
      throw new AppError(400, 'Verification code expired. Tap Resend to get a new code.', 'CODE_EXPIRED');
    }

    if (!user.emailVerifyCode || user.emailVerifyCode !== normalizedCode) {
      throw new AppError(400, 'Invalid verification code. Please check and try again.', 'CODE_INVALID');
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyCode: null,
        emailVerifyExpiry: null,
      },
      select: userPublicSelect,
    });

    const tokens = await this.createSession(updated.id, updated.email);
    return { user: updated, ...tokens };
  }

  async resendVerification(email: string) {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) throw new AppError(404, 'User not found');
    if (user.emailVerified) throw new AppError(400, 'Email already verified');

    const verifyCode = generateVerificationCode();
    const verifyExpiry = getVerifyExpiry();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifyCode: verifyCode,
        emailVerifyExpiry: verifyExpiry,
      },
    });

    try {
      await sendVerificationEmail(user.email, verifyCode, user.firstName);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send verification email';
      throw new AppError(502, message, 'EMAIL_SEND_FAILED');
    }

    return {
      message: 'New verification code sent to your email.',
      expiresInMinutes: Math.round(config.verifyCodeExpiryMs / 60000),
    };
  }

  async login(email: string, password: string, deviceInfo?: string, ipAddress?: string) {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      throw new AppError(
        404,
        'No account available for this email. Please create one.',
        'EMAIL_NOT_FOUND'
      );
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      throw new AppError(401, 'Incorrect password. Please try again.', 'INVALID_PASSWORD');
    }

    if (!user.emailVerified) {
      // User completed verification (codes cleared) but flag missing — repair legacy/broken rows
      if (!user.emailVerifyCode && !user.emailVerifyExpiry) {
        await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: true },
        });
      } else {
        throw new AppError(
          403,
          'Please verify your email first. Check your inbox for the 6-digit code or tap Resend on the verification screen.',
          'EMAIL_NOT_VERIFIED'
        );
      }
    }

    const tokens = await this.createSession(user.id, user.email, deviceInfo, ipAddress);

    await prisma.user.update({
      where: { id: user.id },
      data: { status: 'ONLINE', lastSeen: new Date() },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        emailVerified: true,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarId: user.avatarId,
        university: user.university,
      },
      ...tokens,
    };
  }

  async createSession(
    userId: string,
    email: string,
    deviceInfo?: string,
    ipAddress?: string
  ) {
    const accessToken = generateAccessToken({ userId, email });
    const refreshToken = generateRefreshToken();
    const expiresAt = parseExpiresIn(config.jwt.refreshExpiresIn);

    await prisma.session.create({
      data: { userId, refreshToken, deviceInfo, ipAddress, expiresAt },
    });

    return { accessToken, refreshToken };
  }

  async refreshAccessToken(refreshToken: string) {
    const session = await prisma.session.findUnique({
      where: { refreshToken },
      include: { user: { select: { id: true, email: true, emailVerified: true } } },
    });

    if (!session || session.expiresAt < new Date()) {
      if (session) await prisma.session.delete({ where: { id: session.id } });
      throw new AppError(401, 'Invalid or expired refresh token');
    }

    if (!session.user.emailVerified) {
      throw new AppError(403, 'Email not verified');
    }

    const accessToken = generateAccessToken({
      userId: session.user.id,
      email: session.user.email,
    });

    return { accessToken };
  }

  async logout(refreshToken: string) {
    await prisma.session.deleteMany({ where: { refreshToken } });
    return { message: 'Logged out successfully' };
  }

  async logoutAll(userId: string) {
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'OFFLINE', lastSeen: new Date() },
    });
    return { message: 'Logged out from all devices' };
  }

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) return { message: 'If the email exists, a reset code has been sent' };

    const resetCode = generateVerificationCode();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: resetCode,
        resetTokenExpiry: getVerifyExpiry(),
      },
    });

    await sendPasswordResetEmail(user.email, resetCode, user.firstName);
    return { message: 'If the email exists, a reset code has been sent' };
  }

  async resetPassword(email: string, code: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) throw new AppError(400, 'Invalid reset request');
    if (user.resetToken !== code) throw new AppError(400, 'Invalid reset code');
    if (user.resetTokenExpiry && user.resetTokenExpiry < new Date()) {
      throw new AppError(400, 'Reset code expired');
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    await prisma.session.deleteMany({ where: { userId: user.id } });
    return { message: 'Password reset successful' };
  }

  checkPasswordStrength(password: string) {
    return getPasswordStrength(password);
  }

  async checkUsernameAvailable(username: string) {
    const existing = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
    });
    return { available: !existing };
  }
}

export const authService = new AuthService();
