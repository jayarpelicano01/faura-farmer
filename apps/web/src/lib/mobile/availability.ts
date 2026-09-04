import { notFound } from '@/lib/http';
import { hasMobileAuthSecret } from './tokens';

/**
 * Mobile endpoints are deliberately opt-in and unavailable from a production
 * deployment. Vercel Preview runs with NODE_ENV=production, hence VERCEL_ENV.
 */
export function mobileApiIsEnabled() {
  const localDevelopment = process.env.NODE_ENV !== 'production';
  const previewDeployment = process.env.VERCEL_ENV === 'preview';
  return process.env.MOBILE_API_ENABLED === 'true' && hasMobileAuthSecret() && (localDevelopment || previewDeployment);
}

export function mobileApiDisabledResponse() {
  return notFound('Mobile API is not enabled in this environment');
}
