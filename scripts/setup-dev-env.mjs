import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function ensureEnv(subdir, filename) {
  const target = path.join(root, subdir, filename);
  const example = path.join(root, subdir, `${filename}.example`);

  if (fs.existsSync(target)) {
    console.log(`✓ ${subdir}/${filename} exists`);
    return;
  }

  if (!fs.existsSync(example)) {
    console.warn(`⚠ Missing ${subdir}/${filename}.example — create ${subdir}/${filename} manually.`);
    return;
  }

  fs.copyFileSync(example, target);
  console.log(`✓ Created ${subdir}/${filename} from example`);
}

ensureEnv('backend', '.env.development');
ensureEnv('mobile', '.env.development');

console.log('');
console.log('Local URLs:');
console.log('  API:    http://localhost:3001');
console.log('  App:    http://localhost:8081');
console.log('  Health: http://localhost:3001/health');
