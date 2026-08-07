import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { isRailway } from './platform';

const nodeEnv = process.env.NODE_ENV || 'development';
process.env.NODE_ENV = nodeEnv;

const root = process.cwd();
const envFile = path.join(root, `.env.${nodeEnv}`);
const legacyEnvFile = path.join(root, '.env');

// On Railway, use dashboard variables only — never override with a local file.
if (!isRailway()) {
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile, override: true });
  } else if (nodeEnv !== 'production' && fs.existsSync(legacyEnvFile)) {
    dotenv.config({ path: legacyEnvFile, override: true });
  }
}

export const loadedEnvFile =
  !isRailway() && fs.existsSync(envFile)
    ? `.env.${nodeEnv}`
    : !isRailway() && nodeEnv !== 'production' && fs.existsSync(legacyEnvFile)
      ? '.env'
      : null;

export const currentNodeEnv = nodeEnv;
