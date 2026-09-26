import { actionDefinitionSchema, actionIdSchema } from '@pc-monitor/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../../app.js';
import { actionRegistry, findAction, listActionDefinitions } from './registry.js';

describe('action registry', () => {
  it('has exactly one entry per shared action id, keyed by its own id', () => {
    expect(Object.keys(actionRegistry).sort()).toEqual([...actionIdSchema.options].sort());
    for (const [key, entry] of Object.entries(actionRegistry)) expect(entry.id).toBe(key);
  });

  it('points every action at a plain .ps1 file name, never a path', () => {
    for (const entry of Object.values(actionRegistry)) {
      expect(entry.script).toMatch(/^[a-z0-9-]+\.ps1$/);
    }
  });

  it('requires confirmation for the destructive actions only', () => {
    const confirmed = Object.values(actionRegistry)
      .filter((a) => a.requiresConfirm)
      .map((a) => a.id)
      .sort();
    expect(confirmed).toEqual(['empty-recyclebin', 'kill-process']);
  });

  it('finds known ids and nothing else, including prototype names', () => {
    expect(findAction('flush-dns')?.script).toBe('flush-dns.ps1');
    for (const id of ['nope', 'constructor', '__proto__', 'toString', 'hasOwnProperty', '']) {
      expect(findAction(id)).toBeUndefined();
    }
  });
});

describe('buildArgs', () => {
  it('passes the pid to kill-process as a separate -ProcessId argument', () => {
    expect(actionRegistry['kill-process'].buildArgs({ pid: 1234 })).toEqual(['-ProcessId', '1234']);
  });

  it('refuses kill-process without a pid', () => {
    expect(() => actionRegistry['kill-process'].buildArgs({})).toThrow(/needs a pid/);
  });

  it('refuses a pid for system actions', () => {
    for (const id of ['flush-dns', 'clear-temp', 'empty-recyclebin'] as const) {
      expect(actionRegistry[id].buildArgs({})).toEqual([]);
      expect(() => actionRegistry[id].buildArgs({ pid: 1 })).toThrow(/does not take a pid/);
    }
  });
});

describe('GET /api/actions', () => {
  it('lists metadata matching the shared schema and nothing internal', async () => {
    const res = await request(app).get('/api/actions');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
    for (const action of res.body) {
      expect(actionDefinitionSchema.strict().parse(action)).toBeTruthy(); // strict: no extra keys
      expect(Object.keys(action)).not.toContain('script');
      expect(Object.keys(action)).not.toContain('buildArgs');
      expect(JSON.stringify(action)).not.toMatch(/\.ps1/);
    }
    expect(res.body).toEqual(listActionDefinitions());
  });
});
