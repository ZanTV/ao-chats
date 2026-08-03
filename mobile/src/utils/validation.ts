export class ApiError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

export function formatApiError(err: {
  error?: string;
  code?: string;
  details?: Record<string, string[] | undefined>;
}): string {
  if (err.details) {
    const messages = Object.entries(err.details)
      .flatMap(([field, msgs]) => (msgs || []).map((m) => `${field}: ${m}`));
    if (messages.length > 0) return messages.join('\n');
  }
  return err.error || 'Something went wrong';
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
