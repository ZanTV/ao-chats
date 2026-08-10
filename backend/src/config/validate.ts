const LOCALHOST_PATTERN = /localhost|127\.0\.0\.1/i;

const PRODUCTION_REQUIRED = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'CLIENT_URL',
  'SOCKET_CORS_ORIGIN',
] as const;

const PRODUCTION_NO_LOCALHOST = [
  'DATABASE_URL',
  'REDIS_URL',
  'CLIENT_URL',
  'CORS_ORIGIN',
  'SOCKET_CORS_ORIGIN',
  'API_URL',
  'SOCKET_URL',
] as const;

const DEVELOPMENT_REQUIRED = ['DATABASE_URL'] as const;

const DEFAULT_JWT_SECRET = 'your-super-secret-jwt-key-change-in-production';
const DEFAULT_DEV_JWT_SECRET = 'dev-secret-change-me';

function hostedPlatformLabel(): string {
  if (process.env.RENDER === 'true' || process.env.RENDER_SERVICE_ID) return 'Render';
  if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID) return 'Railway';
  return 'Render/Railway';
}

export interface EnvValidationResult {
  valid: boolean;
  environment: string;
  loadedFile: string | null;
  missing: string[];
  localhostViolations: string[];
  warnings: string[];
}

function getEnv(name: string): string | undefined {
  const value = process.env[name];
  return value?.trim() ? value.trim() : undefined;
}

function findLocalhostViolations(keys: readonly string[]): string[] {
  return keys.filter((key) => {
    const value = getEnv(key);
    return value ? LOCALHOST_PATTERN.test(value) : false;
  });
}

export function validateEnvironment(
  nodeEnv: string,
  loadedFile: string | null
): EnvValidationResult {
  const isProduction = nodeEnv === 'production';
  const missing: string[] = [];
  const warnings: string[] = [];

  const required = isProduction ? PRODUCTION_REQUIRED : DEVELOPMENT_REQUIRED;

  for (const key of required) {
    if (key === 'SOCKET_CORS_ORIGIN') {
      if (
        !getEnv('SOCKET_CORS_ORIGIN') &&
        !getEnv('CORS_ORIGIN') &&
        !getEnv('CLIENT_URL')
      ) {
        missing.push('SOCKET_CORS_ORIGIN (or CORS_ORIGIN / CLIENT_URL)');
      }
      continue;
    }
    if (!getEnv(key)) {
      missing.push(key);
    }
  }

  if (isProduction) {
    const jwtSecret = getEnv('JWT_SECRET');
    const jwtRefresh = getEnv('JWT_REFRESH_SECRET');
    if (
      !jwtSecret ||
      jwtSecret.includes('<') ||
      jwtSecret === DEFAULT_JWT_SECRET ||
      jwtSecret === DEFAULT_DEV_JWT_SECRET
    ) {
      missing.push('JWT_SECRET (set a strong production secret, not a placeholder)');
    }
    if (!jwtRefresh || jwtRefresh.includes('<')) {
      missing.push('JWT_REFRESH_SECRET (set a strong production secret, not a placeholder)');
    }
  }

  if (!getEnv('OBJECT_STORAGE_ENDPOINT')) {
    warnings.push('OBJECT_STORAGE_ENDPOINT is not set (optional until file uploads are enabled)');
  }
  if (!getEnv('OBJECT_STORAGE_BUCKET')) {
    warnings.push('OBJECT_STORAGE_BUCKET is not set (optional until file uploads are enabled)');
  }

  const mediaProvider = (getEnv('MEDIA_STORAGE_PROVIDER') || 'local').toLowerCase();
  if (mediaProvider === 'agrohub' && !getEnv('STORAGE_API_SECRET')) {
    warnings.push(
      'MEDIA_STORAGE_PROVIDER=agrohub but STORAGE_API_SECRET is not set (chat uploads will fail)'
    );
  }
  if (mediaProvider !== 'local' && mediaProvider !== 'agrohub') {
    warnings.push(
      `MEDIA_STORAGE_PROVIDER="${mediaProvider}" is unknown (expected local or agrohub)`
    );
  }

  const profileProvider = (getEnv('PROFILE_STORAGE_PROVIDER') || 'local').toLowerCase();
  if (profileProvider === 'agrohub' && !getEnv('STORAGE_API_SECRET')) {
    warnings.push(
      'PROFILE_STORAGE_PROVIDER=agrohub but STORAGE_API_SECRET is not set (profile uploads will fail)'
    );
  }
  if (profileProvider !== 'local' && profileProvider !== 'agrohub') {
    warnings.push(
      `PROFILE_STORAGE_PROVIDER="${profileProvider}" is unknown (expected local or agrohub)`
    );
  }

  const localhostViolations = isProduction
    ? findLocalhostViolations(PRODUCTION_NO_LOCALHOST)
    : [];

  return {
    valid: missing.length === 0 && localhostViolations.length === 0,
    environment: nodeEnv,
    loadedFile,
    missing,
    localhostViolations,
    warnings,
  };
}

export function formatValidationError(result: EnvValidationResult): string {
  const lines: string[] = ['Environment configuration failed.'];

  if (result.loadedFile) {
    lines.push(`Loaded file: ${result.loadedFile}`);
  } else if (result.environment === 'production') {
    lines.push(
      `Using platform-injected environment variables (${hostedPlatformLabel()}).`
    );
  } else {
    lines.push('No .env.development or .env file found.');
  }

  if (result.missing.length > 0) {
    lines.push('');
    lines.push('Missing required variables:');
    for (const key of result.missing) {
      lines.push(`  - ${key}`);
    }
  }

  if (result.localhostViolations.length > 0) {
    lines.push('');
    lines.push('Production must not use localhost:');
    for (const key of result.localhostViolations) {
      lines.push(`  - ${key}`);
    }
  }

  return lines.join('\n');
}

export function getProductionVariableChecklist(): { name: string; present: boolean }[] {
  return PRODUCTION_REQUIRED.map((name) => {
    if (name === 'SOCKET_CORS_ORIGIN') {
      return {
        name,
        present: Boolean(
          getEnv('SOCKET_CORS_ORIGIN') || getEnv('CORS_ORIGIN') || getEnv('CLIENT_URL')
        ),
      };
    }
    return {
      name,
      present: Boolean(getEnv(name)),
    };
  });
}

/** @deprecated Use getProductionVariableChecklist */
export const getRailwayVariableChecklist = getProductionVariableChecklist;
