import nodemailer from 'nodemailer';
import { config, isEmailConfigured } from '../config';

let transporter: nodemailer.Transporter | null = null;
let transporterVerified = false;

function getTransporter(): nodemailer.Transporter {
  if (!isEmailConfigured()) {
    throw new Error(
      'Email is not configured. Add SMTP_USER and SMTP_PASS to backend/.env (use Gmail App Password).'
    );
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
  }
  return transporter;
}

export async function verifyEmailTransport(): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.warn('⚠ Email not configured — set SMTP_USER and SMTP_PASS in .env to send real codes');
    return false;
  }
  try {
    await Promise.race([
      getTransporter().verify(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('SMTP verify timed out after 8s')), 8000)
      ),
    ]);
    transporterVerified = true;
    console.log(`✓ Email ready (${config.smtp.user})`);
    return true;
  } catch (err) {
    console.error('✗ Email configuration invalid:', err instanceof Error ? err.message : err);
    return false;
  }
}

function expiryMinutes(): number {
  return Math.round(config.verifyCodeExpiryMs / 60000);
}

export async function sendVerificationEmail(
  email: string,
  code: string,
  firstName: string
): Promise<void> {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
      <h1 style="color: #2563EB; font-size: 24px; margin-bottom: 8px;">AO Chats</h1>
      <p style="color: #374151; font-size: 16px; margin-bottom: 8px;">Hi ${firstName},</p>
      <p style="color: #374151; font-size: 16px; margin-bottom: 24px;">Use this code to verify your account:</p>
      <div style="background: #F3F4F6; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
        <span style="font-size: 36px; font-weight: bold; letter-spacing: 10px; color: #2563EB;">${code}</span>
      </div>
      <p style="color: #EF4444; font-size: 14px; font-weight: 600;">This code expires in ${expiryMinutes()} minutes.</p>
      <p style="color: #6B7280; font-size: 13px; margin-top: 16px;">If you did not create an AO Chats account, ignore this email.</p>
    </div>
  `;

  const transport = getTransporter();
  await transport.sendMail({
    from: config.smtp.from,
    to: email,
    subject: `${code} — Your AO Chats verification code`,
    html,
    text: `Your AO Chats verification code is ${code}. It expires in ${expiryMinutes()} minutes.`,
  });

  console.log(`✓ Verification code sent to ${email} (expires in ${expiryMinutes()} min)`);
}

export async function sendPasswordResetEmail(
  email: string,
  code: string,
  firstName: string
): Promise<void> {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
      <h1 style="color: #2563EB; font-size: 24px; margin-bottom: 8px;">AO Chats</h1>
      <p style="color: #374151; font-size: 16px; margin-bottom: 24px;">Hi ${firstName},</p>
      <p style="color: #374151; font-size: 16px; margin-bottom: 24px;">Your password reset code is:</p>
      <div style="background: #F3F4F6; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
        <span style="font-size: 36px; font-weight: bold; letter-spacing: 10px; color: #2563EB;">${code}</span>
      </div>
      <p style="color: #EF4444; font-size: 14px; font-weight: 600;">This code expires in ${expiryMinutes()} minutes.</p>
      <p style="color: #6B7280; font-size: 14px;">If you didn't request this, ignore this email.</p>
    </div>
  `;

  const transport = getTransporter();
  await transport.sendMail({
    from: config.smtp.from,
    to: email,
    subject: `${code} — Reset your AO Chats password`,
    html,
    text: `Your AO Chats password reset code is ${code}. It expires in ${expiryMinutes()} minutes.`,
  });

  console.log(`✓ Password reset code sent to ${email}`);
}
