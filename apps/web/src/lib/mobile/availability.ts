import { notFound } from '../http';
import { hasMobileAuthSecret } from './tokens';

export function mobileApiIsEnabled() {
  return process.env.MOBILE_API_ENABLED === 'true' && hasMobileAuthSecret();
}

export function mobileApiDisabledResponse() {
  return notFound('Mobile API is not enabled in this environment');
}
