import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
process.env.NODE_ENV = nodeEnv;

const root = process.cwd();
const envFile = path.join(root, `.env.${nodeEnv}`);
const legacyEnvFile = path.join(root, '.env');

if (fs.existsSync(envFile)) {
  // Override stale OS/shell variables so .env.production / .env.development wins locally
  dotenv.config({ path: envFile, override: true });
} else if (nodeEnv !== 'production' && fs.existsSync(legacyEnvFile)) {
  dotenv.config({ path: legacyEnvFile, override: true });
}

export const loadedEnvFile = fs.existsSync(envFile)
  ? `.env.${nodeEnv}`
  : nodeEnv !== 'production' && fs.existsSync(legacyEnvFile)
    ? '.env'
    : null;

export const currentNodeEnv = nodeEnv;
