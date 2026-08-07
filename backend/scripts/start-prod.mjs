import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

process.chdir(root);
await import('./prepare-env.mjs');

console.log('Applying database schema…');
try {
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    stdio: 'inherit',
    env: process.env,
  });
} catch (err) {
  console.error('prisma db push failed — starting server anyway:', err?.message || err);
}

console.log('Starting AO Chats API…');
execSync('node dist/index.js', { stdio: 'inherit', env: process.env });
