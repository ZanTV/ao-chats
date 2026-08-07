import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';

function run(command, args, options = {}) {
  return spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: isWindows,
    env: process.env,
    ...options,
  });
}

function tryDockerUp() {
  return new Promise((resolve) => {
    const child = run('docker', ['compose', 'up', '-d'], { stdio: 'pipe' });
    child.on('exit', (code) => {
      if (code === 0) {
        console.log('✓ Docker: PostgreSQL + Redis started');
      } else {
        console.warn('⚠ Docker not started — using DATABASE_URL from backend/.env.development');
      }
      resolve();
    });
    child.on('error', () => {
      console.warn('⚠ Docker not available — using DATABASE_URL from backend/.env.development');
      resolve();
    });
  });
}

async function openAppWhenReady() {
  const waitOn = (await import('wait-on')).default;
  const open = (await import('open')).default;

  try {
    await waitOn({
      resources: ['http://localhost:8081', 'http://localhost:3001/health'],
      timeout: 120000,
      validateStatus: (status) => status >= 200 && status < 500,
    });
    await open('http://localhost:8081');
    console.log('✓ Opened http://localhost:8081');
  } catch {
    console.warn('⚠ App did not become ready in time — open http://localhost:8081 manually');
  }
}

await import('./setup-dev-env.mjs');
await tryDockerUp();

console.log('');
console.log('Starting AO Chats local dev (backend + web app)...');
console.log('');

const backend = run('npm', ['run', 'dev'], { cwd: path.join(root, 'backend') });
const mobile = run('npm', ['run', 'web'], { cwd: path.join(root, 'mobile') });

void openAppWhenReady();

function shutdown(code = 0) {
  backend.kill('SIGTERM');
  mobile.kill('SIGTERM');
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

backend.on('exit', (code) => {
  if (code && code !== 0) shutdown(code);
});

mobile.on('exit', (code) => {
  if (code && code !== 0) shutdown(code);
});
