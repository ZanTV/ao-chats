/**
 * Ensures Prisma env vars exist before `prisma generate` / `db push`.
 * Railway build may run before runtime secrets are injected — use a placeholder
 * so schema validation passes; runtime uses real DATABASE_URL from the platform.
 */
const dbUrl = process.env.DATABASE_URL?.trim();

if (!process.env.DATABASE_URL_UNPOOLED?.trim()) {
  process.env.DATABASE_URL_UNPOOLED = dbUrl || 'postgresql://build:build@127.0.0.1:5432/build';
}

if (!dbUrl && process.env.NODE_ENV === 'production') {
  console.warn(
    'DATABASE_URL not set yet — using placeholder for Prisma CLI (set DATABASE_URL on Railway).'
  );
}
