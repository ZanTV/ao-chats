/**
 * Legacy entry for Docker/Railway. On Render use: node dist/index.js
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
await import('./prepare-env.mjs');

console.log('→ Starting AO Chats API (dist/index.js)…');
const server = spawn('node', ['dist/index.js'], { stdio: 'inherit', env: process.env });

server.on('exit', (exitCode, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(exitCode ?? 1);
});
