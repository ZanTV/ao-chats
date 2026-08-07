/** Returns true when running on Railway. */
export function isRailway(): boolean {
  return Boolean(
    process.env.RAILWAY_ENVIRONMENT ||
      process.env.RAILWAY_PROJECT_ID ||
      process.env.RAILWAY_SERVICE_ID
  );
}

/** Returns true when running on Render. */
export function isRender(): boolean {
  return Boolean(
    process.env.RENDER === 'true' ||
      process.env.RENDER_SERVICE_ID ||
      process.env.RENDER_SERVICE_NAME
  );
}

/** Railway, Render, or any PaaS that injects env vars (skip local .env files). */
export function isHostedPlatform(): boolean {
  return isRailway() || isRender();
}

export function hostedPlatformName(): string {
  if (isRender()) return 'Render';
  if (isRailway()) return 'Railway';
  return 'hosted platform';
}
