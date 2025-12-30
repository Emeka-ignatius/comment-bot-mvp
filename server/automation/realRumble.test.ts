import { describe, it, expect } from 'vitest';
import { parseRawCookies } from './realRumble';

describe('parseRawCookies', () => {
  it('should parse raw cookie string format correctly', () => {
    const rawCookies = '__cf_bm=abc123; RNSC=127.0.0.1; a_s=xyz789';
    const cookies = parseRawCookies(rawCookies);
    
    expect(cookies).toHaveLength(3);
    expect(cookies[0]).toMatchObject({
      name: '__cf_bm',
      value: 'abc123',
      domain: '.rumble.com',
      path: '/',
      secure: true,
      sameSite: 'None',
    });
    expect(cookies[1]).toMatchObject({
      name: 'RNSC',
      value: '127.0.0.1',
    });
    expect(cookies[2]).toMatchObject({
      name: 'a_s',
      value: 'xyz789',
    });
  });

  it('should handle cookies with equals signs in values', () => {
    const rawCookies = 'token=abc=def=ghi; session=123';
    const cookies = parseRawCookies(rawCookies);
    
    expect(cookies).toHaveLength(2);
    expect(cookies[0]).toMatchObject({
      name: 'token',
      value: 'abc=def=ghi', // Value should preserve all equals signs
    });
  });

  it('should handle complex real-world cookie strings', () => {
    const rawCookies = '__cf_bm=pBJFbA7.9yBM1kezV3aogxEy0eyflKblx9VOG47MVZE-1767005964-1.0.1.1-aUmop23wedUWqwcLZNhLtiHvPdc2e5eFyaw05VuoY1l12Y76jqFtnnOoPQsqEFgqrpLPWfnK_unyiDb5PGzVah7Sxj82ABgSQ.z2oOYhWxI; RNSC=137.184.173.137; a_s=75aP0aBb2WMxppV6lVLJg';
    const cookies = parseRawCookies(rawCookies);
    
    expect(cookies).toHaveLength(3);
    expect(cookies[0].name).toBe('__cf_bm');
    expect(cookies[0].value).toContain('pBJFbA7');
    expect(cookies[1].name).toBe('RNSC');
    expect(cookies[2].name).toBe('a_s');
  });

  it('should set correct expiration time (approximately 7.6 days from now)', () => {
    const rawCookies = 'test=value';
    const cookies = parseRawCookies(rawCookies);
    
    const now = Math.floor(Date.now() / 1000);
    const expectedExpiry = now + 657000; // ~7.6 days
    
    // Allow 10 second tolerance for test execution time
    expect(cookies[0].expires).toBeGreaterThan(now);
    expect(cookies[0].expires).toBeLessThan(expectedExpiry + 10);
  });

  it('should handle JSON array format', () => {
    const jsonCookies = JSON.stringify([
      { name: 'cookie1', value: 'value1', domain: '.example.com' },
      { name: 'cookie2', value: 'value2' },
    ]);
    const cookies = parseRawCookies(jsonCookies);
    
    expect(cookies).toHaveLength(2);
    expect(cookies[0].name).toBe('cookie1');
    expect(cookies[0].value).toBe('value1');
    expect(cookies[0].domain).toBe('.example.com'); // Should preserve original domain
    expect(cookies[1].domain).toBe('.rumble.com'); // Should default to rumble.com
  });

  it('should return empty array for empty string', () => {
    const cookies = parseRawCookies('');
    expect(cookies).toHaveLength(0);
  });

  it('should handle single cookie', () => {
    const rawCookies = 'single_cookie=single_value';
    const cookies = parseRawCookies(rawCookies);
    
    expect(cookies).toHaveLength(1);
    expect(cookies[0].name).toBe('single_cookie');
    expect(cookies[0].value).toBe('single_value');
  });

  it('should set httpOnly to false for raw cookies', () => {
    const rawCookies = 'test=value';
    const cookies = parseRawCookies(rawCookies);
    
    expect(cookies[0].httpOnly).toBe(false);
  });

  it('should handle cookies with special characters in values', () => {
    const rawCookies = 'cf_clearance=xH.N1qDnDr3vX15CgM5gBcQyJQIW3LX2ZnUG9eipf8c-1767006059-1.2.1.1-RTDsoPF3s2cOpKNk7XpfCEjoUIGVYu5k1PjJoQgM8.VhKe23';
    const cookies = parseRawCookies(rawCookies);
    
    expect(cookies).toHaveLength(1);
    expect(cookies[0].name).toBe('cf_clearance');
    expect(cookies[0].value).toContain('xH.N1qDnDr3vX15');
  });
});

describe('Cookie format validation', () => {
  it('should produce cookies compatible with Playwright addCookies', () => {
    const rawCookies = 'test=value';
    const cookies = parseRawCookies(rawCookies);
    
    // Playwright requires these fields
    const cookie = cookies[0];
    expect(cookie).toHaveProperty('name');
    expect(cookie).toHaveProperty('value');
    expect(cookie).toHaveProperty('domain');
    expect(cookie).toHaveProperty('path');
    expect(cookie).toHaveProperty('expires');
    expect(cookie).toHaveProperty('httpOnly');
    expect(cookie).toHaveProperty('secure');
    expect(cookie).toHaveProperty('sameSite');
    
    // Validate types
    expect(typeof cookie.name).toBe('string');
    expect(typeof cookie.value).toBe('string');
    expect(typeof cookie.domain).toBe('string');
    expect(typeof cookie.path).toBe('string');
    expect(typeof cookie.expires).toBe('number');
    expect(typeof cookie.httpOnly).toBe('boolean');
    expect(typeof cookie.secure).toBe('boolean');
    expect(['Strict', 'Lax', 'None']).toContain(cookie.sameSite);
  });
});
