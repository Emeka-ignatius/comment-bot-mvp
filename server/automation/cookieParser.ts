/**
 * Parse raw cookie strings from browser dev tools into Playwright cookie format
 * Handles both raw cookie strings and JSON formatted cookies
 */

interface PlaywrightCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export function parseCookies(cookieInput: string, platform: 'youtube' | 'rumble'): PlaywrightCookie[] {
  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(cookieInput);
    if (Array.isArray(parsed)) {
      return parsed.map(cookie => normalizeCookie(cookie, platform));
    }
    if (typeof parsed === 'object') {
      return [normalizeCookie(parsed, platform)];
    }
  } catch (e) {
    // Not JSON, treat as raw cookie string
  }

  // Parse raw cookie string (e.g., "name1=value1; name2=value2")
  const cookies: PlaywrightCookie[] = [];
  const cookiePairs = cookieInput.split(';').map(c => c.trim());

  for (const pair of cookiePairs) {
    if (!pair) continue;

    const [name, ...valueParts] = pair.split('=');
    const value = valueParts.join('='); // Handle values with '=' in them

    if (name && value) {
      cookies.push({
        name: name.trim(),
        value: value.trim(),
        domain: platform === 'youtube' ? '.youtube.com' : '.rumble.com',
        path: '/',
        expires: Math.floor(Date.now() / 1000) + 86400 * 365, // 1 year
        httpOnly: false,
        secure: true,
        sameSite: 'Lax',
      });
    }
  }

  if (cookies.length === 0) {
    throw new Error('No valid cookies found in the provided string');
  }

  return cookies;
}

function normalizeCookie(cookie: any, platform: 'youtube' | 'rumble'): PlaywrightCookie {
  return {
    name: cookie.name || '',
    value: cookie.value || '',
    domain: cookie.domain || (platform === 'youtube' ? '.youtube.com' : '.rumble.com'),
    path: cookie.path || '/',
    expires: cookie.expires || Math.floor(Date.now() / 1000) + 86400 * 365,
    httpOnly: cookie.httpOnly ?? false,
    secure: cookie.secure ?? true,
    sameSite: cookie.sameSite || 'Lax',
  };
}

export function validateCookies(cookies: PlaywrightCookie[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!Array.isArray(cookies) || cookies.length === 0) {
    errors.push('Cookies must be a non-empty array');
    return { valid: false, errors };
  }

  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i];

    if (!cookie.name || typeof cookie.name !== 'string') {
      errors.push(`Cookie ${i}: Missing or invalid name`);
    }

    if (!cookie.value || typeof cookie.value !== 'string') {
      errors.push(`Cookie ${i}: Missing or invalid value`);
    }

    if (cookie.domain && typeof cookie.domain !== 'string') {
      errors.push(`Cookie ${i}: Invalid domain`);
    }

    if (cookie.path && typeof cookie.path !== 'string') {
      errors.push(`Cookie ${i}: Invalid path`);
    }

    if (cookie.expires && typeof cookie.expires !== 'number') {
      errors.push(`Cookie ${i}: Invalid expires (must be a number)`);
    }
  }

  return { valid: errors.length === 0, errors };
}
