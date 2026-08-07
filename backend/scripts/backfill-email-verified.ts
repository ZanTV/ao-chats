/**
 * One-time repair: users who cleared verification codes but emailVerified stayed false.
 * Run on production after deploy: npx tsx scripts/backfill-email-verified.ts
 */
import { prisma } from '../src/config/database';

async function main() {
  const result = await prisma.user.updateMany({
    where: {
      emailVerified: false,
      emailVerifyCode: null,
      emailVerifyExpiry: null,
    },
    data: { emailVerified: true },
  });
  console.log(`Backfilled emailVerified for ${result.count} user(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
