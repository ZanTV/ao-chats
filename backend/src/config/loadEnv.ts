import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
process.env.NODE_ENV = nodeEnv;

const root = process.cwd();
const envFile = path.join(root, `.env.${nodeEnv}`);
const legacyEnvFile = path.join(root, '.env');

if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
} else if (nodeEnv !== 'production' && fs.existsSync(legacyEnvFile)) {
  dotenv.config({ path: legacyEnvFile });
}

export const loadedEnvFile = fs.existsSync(envFile)
  ? `.env.${nodeEnv}`
  : nodeEnv !== 'production' && fs.existsSync(legacyEnvFile)
    ? '.env'
    : null;

export const currentNodeEnv = nodeEnv;
