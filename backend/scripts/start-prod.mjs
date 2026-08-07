import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function runNode(script, args = [], label = script) {
  return new Promise((resolve, reject) => {
    console.log(`\n→ ${label}…`);
    const child = spawn('node', [script, ...args], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} failed (exit ${code})`));
    });
  });
}

process.chdir(root);
await import('./prepare-env.mjs');

try {
  await runNode('scripts/production-preflight.mjs', [], 'Production environment check');
  await runNode(
    'scripts/prisma-cli.mjs',
    ['db', 'push', '--skip-generate', '--accept-data-loss'],
    'Database schema sync (Prisma db push)'
  );
} catch (err) {
  console.error('\nDeploy aborted:', err.message);
  process.exit(1);
}

console.log('\n→ Starting AO Chats API…');
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
