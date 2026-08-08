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
} catch (err) {
  console.error('\nDeploy aborted:', err.message);
  process.exit(1);
}

// Migrations run during Render/Railway build (see render.yaml buildCommand).
// Running migrate here blocks the health check and causes 502 on cold starts.
if (process.env.RUN_MIGRATE_ON_START === 'true') {
  try {
    await runNode('scripts/migrate-deploy.mjs', [], 'Database migrations (Prisma migrate deploy)');
  } catch (err) {
    console.error('\nMigration on start failed:', err.message);
    process.exit(1);
  }
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
