import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractChatIdFromUrl, postRumbleCommentDirect } from './directRumbleAPI';

describe('Direct Rumble API', () => {
  describe('extractChatIdFromUrl', () => {
    it('should extract chat ID from standard Rumble URL with title', () => {
      const url = 'https://rumble.com/v73kr84-nitro-age-returns.html';
      const chatId = extractChatIdFromUrl(url);
      expect(chatId).toBe('v73kr84');
    });

    it('should extract chat ID from Rumble URL without title', () => {
      const url = 'https://rumble.com/v73kr84';
      const chatId = extractChatIdFromUrl(url);
      expect(chatId).toBe('v73kr84');
    });

    it('should extract chat ID from embed URL', () => {
      const url = 'https://rumble.com/embed/v73kr84/';
      const chatId = extractChatIdFromUrl(url);
      expect(chatId).toBe('v73kr84');
    });

    it('should extract chat ID from embed URL without trailing slash', () => {
      const url = 'https://rumble.com/embed/v73kr84';
      const chatId = extractChatIdFromUrl(url);
      expect(chatId).toBe('v73kr84');
    });

    it('should handle different video ID formats', () => {
      const url = 'https://rumble.com/v5abc123-test-video.html';
      const chatId = extractChatIdFromUrl(url);
      expect(chatId).toBe('v5abc123');
    });

    it('should return null for invalid URL', () => {
      const url = 'not-a-valid-url';
      const chatId = extractChatIdFromUrl(url);
      expect(chatId).toBe(null);
    });

    it('should return null for URL without video ID', () => {
      const url = 'https://rumble.com/about';
      const chatId = extractChatIdFromUrl(url);
      expect(chatId).toBe(null);
    });

    it('should handle URLs with query parameters', () => {
      const url = 'https://rumble.com/v73kr84-title.html?t=123';
      const chatId = extractChatIdFromUrl(url);
      expect(chatId).toBe('v73kr84');
    });
  });

  describe('postRumbleCommentDirect', () => {
    beforeEach(() => {
      // Reset fetch mock before each test
      vi.restoreAllMocks();
    });

    it('should successfully post comment with valid credentials', async () => {
      // Mock successful API response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      const result = await postRumbleCommentDirect(
        'v73kr84',
        'Test comment',
        'session_id=abc123; user_token=xyz789'
      );

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('rumble.com/service.php'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Cookie': expect.stringContaining('session_id=abc123'),
          }),
        })
      );
    });

    it('should handle API error response', async () => {
      // Mock error API response
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => 'Forbidden',
      });

      const result = await postRumbleCommentDirect(
        'v73kr84',
        'Test comment',
        'invalid_cookies'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('403');
    });

    it('should handle network errors', async () => {
      // Mock network error
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await postRumbleCommentDirect(
        'v73kr84',
        'Test comment',
        'session_id=abc123'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle empty cookie string', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      const result = await postRumbleCommentDirect(
        'v73kr84',
        'Test comment',
        ''
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No valid cookies');
    });

    it('should parse cookies in browser dev tools format', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      const cookieString = `session_id=abc123
user_token=xyz789
remember_me=true`;

      await postRumbleCommentDirect('v73kr84', 'Test comment', cookieString);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Cookie': expect.stringContaining('session_id=abc123'),
          }),
        })
      );
    });

    it('should include proper headers for API request', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      await postRumbleCommentDirect(
        'v73kr84',
        'Test comment',
        'session_id=abc123'
      );

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': expect.stringContaining('Mozilla'),
            'Referer': expect.stringContaining('rumble.com'),
            'Origin': 'https://rumble.com',
            'X-Requested-With': 'XMLHttpRequest',
          }),
        })
      );
    });

    it('should send correct payload format', async () => {
      let capturedPayload: any;
      
      global.fetch = vi.fn().mockImplementation(async (url, options: any) => {
        capturedPayload = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        };
      });

      await postRumbleCommentDirect(
        'v73kr84',
        'Test comment message',
        'session_id=abc123'
      );

      expect(capturedPayload).toEqual({
        chat_id: 'v73kr84',
        message: 'Test comment message',
      });
    });

    it('should handle API response with error field', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ error: 'Rate limit exceeded' }),
      });

      const result = await postRumbleCommentDirect(
        'v73kr84',
        'Test comment',
        'session_id=abc123'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit exceeded');
    });
  });
});
