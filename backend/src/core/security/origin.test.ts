import { describe, expect, it } from 'vitest';
import { FRONTEND_ORIGIN, SELF_ORIGIN } from '../config/env.js';
import { isOriginAllowed } from './origin.js';

describe('isOriginAllowed', () => {
  it('allows the frontend origin, the server itself and non-browser clients', () => {
    expect(isOriginAllowed(FRONTEND_ORIGIN)).toBe(true);
    expect(isOriginAllowed(SELF_ORIGIN)).toBe(true);
    expect(isOriginAllowed(undefined)).toBe(true);
  });

  it('rejects any other origin, including look-alikes', () => {
    expect(isOriginAllowed('http://evil.example')).toBe(false);
    expect(isOriginAllowed('null')).toBe(false); // sandboxed iframes and file:// pages
    expect(isOriginAllowed(`${FRONTEND_ORIGIN}.evil.example`)).toBe(false);
    expect(isOriginAllowed(FRONTEND_ORIGIN.replace('http:', 'https:'))).toBe(false);
    expect(isOriginAllowed('')).toBe(false);
  });
});
