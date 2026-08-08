/**
 * Ensures Prisma env vars exist before `prisma generate` / migrations.
 * Render/Railway build may run before runtime secrets are injected — use a placeholder
 * so schema validation passes; runtime uses real DATABASE_URL from the platform.
 */
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function isHostedPlatform() {
  return Boolean(
    process.env.RENDER === 'true' ||
      process.env.RENDER_SERVICE_ID ||
      process.env.RAILWAY_ENVIRONMENT ||
      process.env.RAILWAY_PROJECT_ID ||
      process.env.RAILWAY_SERVICE_ID
  );
}

for (const name of ['.env', '.env.development', '.env.production']) {
  if (isHostedPlatform()) break;
  const file = path.join(root, name);
  if (fs.existsSync(file)) {
    dotenv.config({ path: file });
    break;
  }
}

const dbUrl = process.env.DATABASE_URL?.trim();

if (!process.env.DATABASE_URL_UNPOOLED?.trim()) {
  process.env.DATABASE_URL_UNPOOLED = dbUrl || 'postgresql://build:build@127.0.0.1:5432/build';
}

if (!dbUrl && process.env.NODE_ENV === 'production') {
  console.warn(
    'DATABASE_URL not set yet — using placeholder for Prisma CLI (set DATABASE_URL on Render).'
  );
}
