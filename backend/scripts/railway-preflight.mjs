import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { checkProductionEnv, formatPreflightError } from './required-env.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const isRailway = Boolean(
  process.env.RAILWAY_ENVIRONMENT ||
    process.env.RAILWAY_PROJECT_ID ||
    process.env.RAILWAY_SERVICE_ID
);

if (!isRailway) {
  const envProd = path.join(root, '.env.production');
  if (fs.existsSync(envProd)) {
    dotenv.config({ path: envProd, override: true });
    process.env.NODE_ENV = 'production';
  }
}

if (process.env.NODE_ENV !== 'production') {
  console.log('Skipping production env check (NODE_ENV is not production).');
  process.exit(0);
}

const result = checkProductionEnv();

if (result.ok) {
  console.log('✓ Production environment variables OK');
  process.exit(0);
}

console.error(formatPreflightError(result));

if (isRailway) {
  console.error('');
  console.error('Deploy stopped — fix Variables in Railway, then redeploy.');
}

process.exit(1);
