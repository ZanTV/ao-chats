/**
 * Ensures Prisma env vars exist on Railway (Neon unpooled URL optional).
 */
if (!process.env.DATABASE_URL_UNPOOLED?.trim() && process.env.DATABASE_URL?.trim()) {
  process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_URL.trim();
}
