import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const migrationsDir = path.join(root, 'prisma', 'migrations');

process.chdir(root);
await import('./prepare-env.mjs');

function runPrisma(args) {
  return spawnSync('node', ['scripts/prisma-cli.mjs', ...args], {
    cwd: root,
    env: process.env,
    encoding: 'utf8',
  });
}

function listMigrationFolders() {
  if (!fs.existsSync(migrationsDir)) return [];
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function applySqlMigrations() {
  for (const folder of listMigrationFolders()) {
    const sqlPath = path.join(migrationsDir, folder, 'migration.sql');
    if (!fs.existsSync(sqlPath)) continue;
    console.log(`→ Applying SQL migration ${folder}…`);
    const result = runPrisma(['db', 'execute', '--file', sqlPath, '--schema', 'prisma/schema.prisma']);
    if (result.status !== 0) {
      console.error(result.stdout || result.stderr);
      return false;
    }
  }
  return true;
}

function markMigrationsApplied() {
  for (const folder of listMigrationFolders()) {
    console.log(`→ Marking migration ${folder} as applied…`);
    const result = runPrisma(['migrate', 'resolve', '--applied', folder]);
    if (result.status !== 0) {
      console.error(result.stdout || result.stderr);
      return false;
    }
  }
  return true;
}

console.log('→ Running Prisma migrate deploy…');
let deploy = runPrisma(['migrate', 'deploy']);

if (deploy.status !== 0) {
  const output = `${deploy.stdout || ''}${deploy.stderr || ''}`;
  if (output.includes('P3005')) {
    console.warn('Existing database detected — baselining Prisma migrations…');
    if (!applySqlMigrations() || !markMigrationsApplied()) {
      process.exit(1);
    }
    deploy = runPrisma(['migrate', 'deploy']);
  }
}

if (deploy.status !== 0) {
  console.error(deploy.stdout || deploy.stderr);
  process.exit(deploy.status ?? 1);
}

console.log('✓ Database migrations up to date');
