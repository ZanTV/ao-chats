const LOCALHOST = /localhost|127\.0\.0\.1/i;

export const PRODUCTION_REQUIRED = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'CLIENT_URL',
];

export function getEnv(name) {
  const value = process.env[name];
  return value?.trim() ? value.trim() : undefined;
}

export function hasCorsOrigin() {
  return Boolean(getEnv('SOCKET_CORS_ORIGIN') || getEnv('CORS_ORIGIN') || getEnv('CLIENT_URL'));
}

export function checkProductionEnv() {
  const missing = [];

  for (const key of PRODUCTION_REQUIRED) {
    if (!getEnv(key)) missing.push(key);
  }

  if (!hasCorsOrigin()) {
    missing.push('SOCKET_CORS_ORIGIN (or CORS_ORIGIN / CLIENT_URL)');
  }

  const jwtSecret = getEnv('JWT_SECRET');
  if (
    !jwtSecret ||
    jwtSecret.includes('<') ||
    jwtSecret === 'your-super-secret-jwt-key-change-in-production' ||
    jwtSecret === 'dev-secret-change-me'
  ) {
    missing.push('JWT_SECRET (strong production secret)');
  }

  const jwtRefresh = getEnv('JWT_REFRESH_SECRET');
  if (!jwtRefresh || jwtRefresh.includes('<')) {
    missing.push('JWT_REFRESH_SECRET (strong production secret)');
  }

  const localhostViolations = ['DATABASE_URL', 'REDIS_URL', 'CLIENT_URL', 'CORS_ORIGIN', 'SOCKET_CORS_ORIGIN']
    .filter((key) => {
      const value = getEnv(key);
      return value ? LOCALHOST.test(value) : false;
    });

  return {
    ok: missing.length === 0 && localhostViolations.length === 0,
    missing,
    localhostViolations,
  };
}

export function formatPreflightError(result) {
  const lines = ['Railway production env check failed.'];
  lines.push('Set these in Railway Dashboard → your service → Variables → Raw Editor:');
  lines.push('');

  if (result.missing.length) {
    lines.push('Missing:');
    for (const key of result.missing) lines.push(`  - ${key}`);
  }

  if (result.localhostViolations.length) {
    lines.push('');
    lines.push('Must not use localhost:');
    for (const key of result.localhostViolations) lines.push(`  - ${key}`);
  }

  lines.push('');
  lines.push('Local reference: backend/.env.production');
  lines.push('Sync helper: npm run railway:sync-env (from backend/, after railway login)');
  return lines.join('\n');
}
