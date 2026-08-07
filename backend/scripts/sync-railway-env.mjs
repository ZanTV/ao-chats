/**
 * Push backend/.env.production values to Railway (requires: railway login + railway link).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { PRODUCTION_REQUIRED } from './required-env.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(root, '.env.production');

if (!fs.existsSync(envFile)) {
  console.error('Missing backend/.env.production — create it from .env.production.example');
  process.exit(1);
}

dotenv.config({ path: envFile, override: true });

const keys = [
  ...new Set([
    ...PRODUCTION_REQUIRED,
    'NODE_ENV',
    'DATABASE_URL_UNPOOLED',
    'CORS_ORIGIN',
    'SOCKET_CORS_ORIGIN',
    'API_URL',
    'SOCKET_URL',
    'EMAIL_FROM',
    'JWT_EXPIRES_IN',
    'JWT_REFRESH_EXPIRES_IN',
    'VERIFY_CODE_EXPIRY_MINUTES',
    'RATE_LIMIT_WINDOW_MS',
    'RATE_LIMIT_MAX',
  ]),
];

let synced = 0;
let failed = 0;

console.log('Syncing variables to Railway (one by one)…');
console.log('Requires: npx @railway/cli login && npx @railway/cli link (from backend/)');
console.log('');

for (const key of keys) {
  const value = process.env[key]?.trim();
  if (!value) continue;

  const result = spawnSync(
    'npx',
    ['@railway/cli', 'variables', 'set', `${key}=${value}`],
    { cwd: root, stdio: 'pipe', shell: true, encoding: 'utf8' }
  );

  if (result.status === 0) {
    synced += 1;
    console.log(`  ✓ ${key}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${key}`);
  }
}

if (failed > 0 || synced === 0) {
  console.error('');
  console.error('Some variables failed. Paste backend/.env.production into Railway → Variables → Raw Editor.');
  process.exit(1);
}

console.log('');
console.log(`✓ Synced ${synced} variables. Redeploy in Railway dashboard.`);
