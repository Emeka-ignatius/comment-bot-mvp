/**
 * Test OpenAI API Configuration
 */

import { describe, it, expect } from 'vitest';
import { ENV } from '../_core/env';

describe('OpenAI API Configuration', () => {
  it('should have valid OpenAI API key', () => {
    expect(ENV.openaiApiKey).toBeTruthy();
    expect(ENV.openaiApiKey.startsWith('sk-')).toBe(true);
  });

  it('should have correct OpenAI base URL', () => {
    expect(ENV.openaiBaseUrl).toBeTruthy();
    expect(ENV.openaiBaseUrl).toContain('api.openai.com');
  });

  it('should be able to make a simple API call to OpenAI', async () => {
    const response = await fetch(`${ENV.openaiBaseUrl}/models`, {
      headers: {
        'Authorization': `Bearer ${ENV.openaiApiKey}`,
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data)).toBe(true);
  }, 10000); // 10 second timeout for API call
});
