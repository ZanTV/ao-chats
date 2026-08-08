/**
 * Prints missing production env vars before the API starts (Render logs).
 */
import { checkProductionEnv, formatPreflightError } from './required-env.mjs';

const isRender = Boolean(process.env.RENDER === 'true' || process.env.RENDER_SERVICE_ID);
const isProd = process.env.NODE_ENV === 'production';

if (isProd && isRender) {
  const result = checkProductionEnv();
  if (!result.ok) {
    console.error(formatPreflightError(result));
    console.error('');
    console.error('API will start in degraded mode — add missing vars in Render → Environment.');
  } else {
    console.log('✓ Render environment variables OK');
  }
}
