import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

process.chdir(root);
await import('./prepare-env.mjs');

console.log('Checking production environment…');
const preflight = spawn('node', ['scripts/production-preflight.mjs'], {
  stdio: 'inherit',
  env: process.env,
});

preflight.on('exit', (code) => {
  if (code !== 0) {
    process.exit(code ?? 1);
  }

  console.log('Starting AO Chats API…');
  const server = spawn('node', ['dist/index.js'], {
    stdio: 'inherit',
    env: process.env,
  });

  server.on('exit', (exitCode, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(exitCode ?? 1);
  });

  console.log('Applying database schema in background…');
  const dbPush = spawn(
    'node',
    ['scripts/prisma-cli.mjs', 'db', 'push', '--skip-generate', '--accept-data-loss'],
    { stdio: 'inherit', env: process.env }
  );

  dbPush.on('exit', (pushCode) => {
    if (pushCode === 0) {
      console.log('Database schema applied');
    } else {
      console.warn(`prisma db push exited with code ${pushCode}`);
    }
  });
});
