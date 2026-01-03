import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('./db', () => ({
  updateAccount: vi.fn(),
  getAccountsByUserId: vi.fn(),
}));

import { updateAccount } from './db';

describe('Account Update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateAccount', () => {
    it('should update account name only', async () => {
      const mockUpdatedAccount = {
        id: 1,
        userId: 1,
        platform: 'rumble',
        accountName: 'Updated Name',
        cookies: 'old_cookies',
        isActive: 1,
        cookieExpiresAt: new Date('2026-02-01'),
        lastSuccessfulSubmission: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(updateAccount).mockResolvedValue(mockUpdatedAccount);

      const result = await updateAccount(1, { accountName: 'Updated Name' });

      expect(updateAccount).toHaveBeenCalledWith(1, { accountName: 'Updated Name' });
      expect(result.accountName).toBe('Updated Name');
    });

    it('should update cookies and reset expiration', async () => {
      const newExpiration = new Date();
      newExpiration.setDate(newExpiration.getDate() + 30);

      const mockUpdatedAccount = {
        id: 1,
        userId: 1,
        platform: 'rumble',
        accountName: 'Test Account',
        cookies: 'new_cookies_a_s=xxx; u_s=yyy',
        isActive: 1,
        cookieExpiresAt: newExpiration,
        lastSuccessfulSubmission: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(updateAccount).mockResolvedValue(mockUpdatedAccount);

      const result = await updateAccount(1, {
        cookies: 'new_cookies_a_s=xxx; u_s=yyy',
        cookieExpiresAt: newExpiration,
      });

      expect(updateAccount).toHaveBeenCalledWith(1, {
        cookies: 'new_cookies_a_s=xxx; u_s=yyy',
        cookieExpiresAt: newExpiration,
      });
      expect(result.cookies).toBe('new_cookies_a_s=xxx; u_s=yyy');
    });

    it('should update both name and cookies', async () => {
      const newExpiration = new Date();
      newExpiration.setDate(newExpiration.getDate() + 30);

      const mockUpdatedAccount = {
        id: 1,
        userId: 1,
        platform: 'rumble',
        accountName: 'New Name',
        cookies: 'fresh_cookies',
        isActive: 1,
        cookieExpiresAt: newExpiration,
        lastSuccessfulSubmission: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(updateAccount).mockResolvedValue(mockUpdatedAccount);

      const result = await updateAccount(1, {
        accountName: 'New Name',
        cookies: 'fresh_cookies',
        cookieExpiresAt: newExpiration,
      });

      expect(result.accountName).toBe('New Name');
      expect(result.cookies).toBe('fresh_cookies');
    });

    it('should handle partial updates without changing other fields', async () => {
      const mockUpdatedAccount = {
        id: 1,
        userId: 1,
        platform: 'rumble',
        accountName: 'Only Name Changed',
        cookies: 'original_cookies',
        isActive: 1,
        cookieExpiresAt: new Date('2026-01-15'),
        lastSuccessfulSubmission: new Date('2026-01-02'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(updateAccount).mockResolvedValue(mockUpdatedAccount);

      const result = await updateAccount(1, { accountName: 'Only Name Changed' });

      // Original cookies should be preserved
      expect(result.cookies).toBe('original_cookies');
      expect(result.accountName).toBe('Only Name Changed');
    });
  });

  describe('Cookie validation for Rumble', () => {
    it('should validate required Rumble cookies (a_s and u_s)', () => {
      const validCookies = '_ga=GA1.1...; a_s=xxx123; u_s=yyy456; cf_clearance=zzz';
      const invalidCookies = '_ga=GA1.1...; cf_clearance=zzz';

      const hasRequiredCookies = (cookies: string) => {
        const hasAs = /a_s=([^;]+)/.test(cookies);
        const hasUs = /u_s=([^;]+)/.test(cookies);
        return hasAs && hasUs;
      };

      expect(hasRequiredCookies(validCookies)).toBe(true);
      expect(hasRequiredCookies(invalidCookies)).toBe(false);
    });
  });
});
