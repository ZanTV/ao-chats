if (process.argv.includes('--production')) {
  process.env.NODE_ENV = 'production';
}

const checkConnections = process.argv.includes('--check');

async function main() {
  const { PrismaClient } = await import('@prisma/client');
  const { default: Redis } = await import('ioredis');
  const { currentNodeEnv, loadedEnvFile } = await import('../src/config/loadEnv');
  const {
    formatValidationError,
    getRailwayVariableChecklist,
    validateEnvironment,
  } = await import('../src/config/validate');

  const result = validateEnvironment(currentNodeEnv, loadedEnvFile);

  console.log('AO Chats — Environment Validation');
  console.log('================================');
  console.log(`Environment: ${result.environment}`);
  console.log(`Loaded file: ${result.loadedFile ?? '(platform variables)'}`);
  console.log(`Valid: ${result.valid ? 'yes' : 'no'}`);

  if (result.missing.length > 0) {
    console.log('\nMissing variables:');
    for (const key of result.missing) {
      console.log(`  - ${key}`);
    }
  }

  if (result.localhostViolations.length > 0) {
    console.log('\nLocalhost violations:');
    for (const key of result.localhostViolations) {
      console.log(`  - ${key}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log('\nWarnings:');
    for (const warning of result.warnings) {
      console.log(`  - ${warning}`);
    }
  }

  if (currentNodeEnv === 'production') {
    console.log('\nRailway variable checklist:');
    for (const item of getRailwayVariableChecklist()) {
      console.log(`  ${item.present ? '✓' : '✗'} ${item.name}`);
    }
  }

  if (!result.valid) {
    console.error('\n' + formatValidationError(result));
    process.exit(1);
  }

  if (!checkConnections) {
    console.log('\nEnvironment variables loaded successfully.');
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  const redisUrl = process.env.REDIS_URL;

  if (!databaseUrl) {
    console.error('Cannot check database: DATABASE_URL is missing.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✓ Database connection');
  } catch (err) {
    console.error(
      '✗ Database connection failed:',
      err instanceof Error ? err.message : err
    );
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }

  if (redisUrl) {
    const redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });

    try {
      await redis.connect();
      await redis.ping();
      console.log('✓ Redis connection');
    } catch (err) {
      console.error(
        '✗ Redis connection failed:',
        err instanceof Error ? err.message : err
      );
      process.exit(1);
    } finally {
      redis.disconnect();
    }
  } else {
    console.log('✗ Redis connection skipped (REDIS_URL missing)');
  }

  console.log('✓ Socket.IO uses the HTTP server (validated at runtime)');
  console.log('\nAll checks passed.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
