import { describe, expect, it } from 'vitest';
import { actionIdParamsSchema, pidSchema, runActionRequestSchema } from './schema.js';

describe('runActionRequestSchema', () => {
  it('accepts an empty body, confirm and a pid', () => {
    expect(runActionRequestSchema.parse({})).toEqual({});
    expect(runActionRequestSchema.parse({ confirm: true, pid: 1234 })).toEqual({ confirm: true, pid: 1234 });
  });

  it('rejects unknown fields (a typo must not silently skip the confirmation)', () => {
    expect(runActionRequestSchema.safeParse({ confrim: true }).success).toBe(false);
    expect(runActionRequestSchema.safeParse({ script: 'C:/evil.ps1' }).success).toBe(false);
  });

  it('only takes a real boolean for confirm', () => {
    expect(runActionRequestSchema.safeParse({ confirm: 'true' }).success).toBe(false);
    expect(runActionRequestSchema.safeParse({ confirm: 1 }).success).toBe(false);
  });
});

describe('pidSchema', () => {
  it('accepts positive integers, also from path strings', () => {
    expect(pidSchema.parse('1234')).toBe(1234);
    expect(pidSchema.parse(8)).toBe(8);
  });

  it.each(['0', '-1', '1.5', 'abc', '1e3x', String(2 ** 32)])('rejects %s', (value) => {
    expect(pidSchema.safeParse(value).success).toBe(false);
  });
});

describe('actionIdParamsSchema', () => {
  it('accepts slugs and rejects anything that looks like a path', () => {
    expect(actionIdParamsSchema.safeParse({ id: 'flush-dns' }).success).toBe(true);
    for (const id of ['../scripts/x', 'a/b', 'FLUSH', 'x.ps1', '', 'a'.repeat(41)]) {
      expect(actionIdParamsSchema.safeParse({ id }).success).toBe(false);
    }
  });
});
