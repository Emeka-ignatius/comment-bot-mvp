/**
 * Local Development Authentication Bypass
 * 
 * Provides a mock user for local development when Manus OAuth is not available
 */

import { User } from '@shared/types';
import { ENV } from './env';

export const LOCAL_DEV_USER: User = {
  id: 1,
  openId: 'local_dev_user',
  name: 'Local Dev User',
  email: 'dev@localhost',
  loginMethod: 'google',
  role: 'admin',
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

/**
 * Check if we're running in local development mode
 */
export function isLocalDev(): boolean {
  return ENV.localDevMode;
}

/**
 * Get mock user for local development
 */
export function getLocalDevUser(): User | null {
  return isLocalDev() ? LOCAL_DEV_USER : null;
}
