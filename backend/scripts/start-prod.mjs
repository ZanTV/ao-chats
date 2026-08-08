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

function runMigrateInBackground() {
  if (process.env.SKIP_MIGRATE_ON_START === 'true') {
    console.log('Skipping background migration (SKIP_MIGRATE_ON_START=true)');
    return;
  }

  console.log('\n→ Scheduling database migrations in background…');
  const child = spawn('node', ['scripts/migrate-deploy.mjs'], {
    stdio: 'inherit',
    env: process.env,
  });
  child.on('exit', (code) => {
    if (code === 0) {
      console.log('✓ Background migrations finished');
    } else {
      console.error(`✗ Background migrations failed (exit ${code}) — API stays up; check logs`);
    }
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

// Start API immediately so Render health checks pass (avoid 502 on cold start).
console.log('\n→ Starting AO Chats API…');
const server = spawn('node', ['dist/index.js'], {
  stdio: 'inherit',
  env: process.env,
});

setTimeout(runMigrateInBackground, 2000);

server.on('exit', (exitCode, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(exitCode ?? 1);
});
