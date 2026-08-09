export class ApiError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export function classifyHttpError(
  status: number,
  err: { error?: string; message?: string; code?: string; details?: Record<string, string[] | undefined> },
  endpoint?: string
): string {
  const code = err.code;
  const backendMessage = err.error || err.message;

  if (code === 'EMAIL_NOT_VERIFIED') {
    return backendMessage || 'Please verify your email first. Check your inbox or request a new code.';
  }
  if (code === 'EMAIL_NOT_FOUND') {
    return backendMessage || 'No account available for this email. Please create one.';
  }
  if (code === 'INVALID_PASSWORD') {
    return backendMessage || 'Incorrect password. Please try again.';
  }
  if (code === 'VALIDATION_ERROR') {
    return formatApiError(err);
  }
  if (code === 'DB_ERROR' || code === 'INTERNAL_ERROR') {
    return 'AO Chats is temporarily unavailable. Please try again.';
  }
  if (code === 'DB_UNAVAILABLE') {
    return 'AO Chats is temporarily unavailable. Please try again.';
  }

  if (status === 401) {
    const isPublicAuth =
      endpoint &&
      /^\/auth\/(login|register|forgot-password|reset-password|verify|resend)/.test(endpoint);
    if (isPublicAuth) {
      return backendMessage || 'Invalid email or password.';
    }
    return backendMessage || 'Session expired. Please sign in again.';
  }
  if (status === 403) {
    return backendMessage || 'You are not authorized to perform this action.';
  }
  if (status === 404) {
    return backendMessage || 'The requested AO Chats service could not be found.';
  }
  if (status === 500 || status === 502 || status === 503) {
    return 'AO Chats is temporarily unavailable. Please try again.';
  }

  return formatApiError(err);
}

export function formatApiError(err: {
  error?: string;
  message?: string;
  code?: string;
  details?: Record<string, string[] | undefined>;
}): string {
  if (err.details) {
    const messages = Object.entries(err.details)
      .flatMap(([field, msgs]) =>
        (msgs || []).map((m) => {
          if (/expected string.*undefined/i.test(m) || /required/i.test(m)) {
            const label = field.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
            return `${label} is required`;
          }
          return m.includes(':') ? m : `${field}: ${m}`;
        })
      );
    if (messages.length > 0) return messages.join('\n');
  }
  if (err.error && err.error !== 'Validation failed') {
    return err.error;
  }
  const msg = err.error || err.message;
  if (msg) {
    if (/unexpected/i.test(msg)) {
      return 'Could not connect to AO Chats. Check your internet and try again.';
    }
    if (/expected string.*undefined/i.test(msg)) {
      return 'Please fill in all required fields and try again.';
    }
    return msg;
  }
  if (err.code === 'VALIDATION_ERROR') {
    return 'Please check your details and try again.';
  }
  if (err.code === 'INTERNAL_ERROR' || err.code === 'DB_ERROR') {
    return 'Server database error. Please try again in a moment.';
  }
  if (err.code === 'EMAIL_NOT_VERIFIED') {
    return 'Please verify your email first. Check your inbox or request a new code.';
  }
  if (err.code === 'NETWORK_ERROR') {
    return 'Cannot reach the AO Chats server. Check your internet connection.';
  }
  if (err.code === 'SERVER_UNAVAILABLE') {
    return 'AO Chats is temporarily unavailable. Please try again.';
  }
  if (err.code === 'TIMEOUT') {
    return 'The server took too long to respond. Please try again.';
  }
  if (err.code === 'RESET_COOLDOWN') {
    return 'Please wait before requesting another code.';
  }
  if (err.code === 'RESET_EXPIRED') {
    return 'This code has expired. Please request a new one.';
  }
  if (err.code === 'INVALID_RESET_CODE') {
    return 'The verification code is incorrect.';
  }
  if (err.code === 'RESET_ATTEMPTS') {
    return 'Too many attempts. Please request a new code.';
  }
  if (err.code === 'EMAIL_SEND_FAILED') {
    return "We couldn't send the verification code. Please try again.";
  }
  return 'Something went wrong. Please try again.';
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter (A-Z)';
  if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter (a-z)';
  if (!/[0-9]/.test(password)) return 'Password must contain a number (0-9)';
  return null;
}

export function validateUsername(username: string): string | null {
  const trimmed = username.trim();
  if (trimmed.length < 3) return 'Username must be at least 3 characters';
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    return 'Username can only contain letters, numbers, and underscores';
  }
  return null;
}

export function validateMobileNumber(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[\s\-().]/g, '');
  if (!/^\+[1-9]\d{6,14}$/.test(cleaned)) {
    return 'Use international format e.g. +254712345678';
  }
  return null;
}
