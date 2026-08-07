import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

process.chdir(root);
await import('./prepare-env.mjs');

console.log('Starting AO Chats API…');
const server = spawn('node', ['dist/index.js'], {
  stdio: 'inherit',
  env: process.env,
});

server.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

console.log('Applying database schema in background…');
const dbPush = spawn('node', ['scripts/prisma-cli.mjs', 'db', 'push', '--skip-generate', '--accept-data-loss'], {
  stdio: 'inherit',
  env: process.env,
});

dbPush.on('exit', (code) => {
  if (code === 0) {
    console.log('Database schema applied');
  } else {
    console.warn(`prisma db push exited with code ${code}`);
  }
});
