import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import { createWindowsDiskIoSampler, parseRawLine, rateBetween } from './diskIo.js';

type FakeChild = ChildProcessWithoutNullStreams & { stdout: PassThrough; kill: ReturnType<typeof vi.fn> };

function fakeChild(): FakeChild {
  const child = Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: vi.fn(),
  });
  return child as unknown as FakeChild;
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

describe('parseRawLine', () => {
  it('parses "read write timestamp" and rejects anything else', () => {
    expect(parseRawLine('100 200 3000\r')).toEqual({ read: 100, write: 200, ts100ns: 3000 });
    expect(parseRawLine('')).toBeNull();
    expect(parseRawLine('Get-CimInstance : error')).toBeNull();
    expect(parseRawLine('1 2 x')).toBeNull();
  });
});

describe('rateBetween', () => {
  it('divides the byte deltas by the elapsed time', () => {
    expect(rateBetween({ read: 0, write: 0, ts100ns: 0 }, { read: 4_000, write: 1_000, ts100ns: 2e7 })).toEqual({
      readBps: 2_000,
      writeBps: 500,
    });
  });

  it('returns null when time stands still or a counter resets', () => {
    expect(rateBetween({ read: 0, write: 0, ts100ns: 5 }, { read: 1, write: 1, ts100ns: 5 })).toBeNull();
    expect(rateBetween({ read: 9, write: 0, ts100ns: 0 }, { read: 1, write: 1, ts100ns: 1e7 })).toBeNull();
  });
});

describe('createWindowsDiskIoSampler', () => {
  it('spawns PowerShell with an argv array and reports the rate after two readings', async () => {
    const child = fakeChild();
    const spawn = vi.fn(() => child);
    const sampler = createWindowsDiskIoSampler({ spawn });

    expect(sampler.read()).toBeNull();
    expect(spawn).toHaveBeenCalledWith('powershell.exe', expect.arrayContaining(['-NoProfile', '-Command']));

    child.stdout.write('1000 0 0\n');
    await tick();
    expect(sampler.read()).toBeNull(); // one reading is not a rate yet

    child.stdout.write('3000 500 20000000\n');
    await tick();
    expect(sampler.read()).toEqual({ readBps: 1000, writeBps: 250 });
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  it('reports null once the last rate is stale', async () => {
    let now = 0;
    const child = fakeChild();
    const sampler = createWindowsDiskIoSampler({ spawn: () => child, now: () => now, staleMs: 5_000 });
    sampler.read();
    child.stdout.write('0 0 0\n1 1 10000000\n');
    await tick();
    expect(sampler.read()).toEqual({ readBps: 1, writeBps: 1 });
    now = 6_000;
    expect(sampler.read()).toBeNull();
  });

  it('respawns a dead sampler, but not more often than the restart delay', () => {
    let now = 0;
    const children = [fakeChild(), fakeChild()];
    const spawn = vi.fn(() => children[spawn.mock.calls.length - 1]!);
    const sampler = createWindowsDiskIoSampler({ spawn, now: () => now, restartDelayMs: 30_000 });

    sampler.read();
    children[0]!.emit('close', 1);
    now = 10_000;
    sampler.read();
    expect(spawn).toHaveBeenCalledTimes(1);
    now = 31_000;
    sampler.read();
    expect(spawn).toHaveBeenCalledTimes(2);
  });

  it('kills the child on stop', () => {
    const child = fakeChild();
    const sampler = createWindowsDiskIoSampler({ spawn: () => child });
    sampler.read();
    sampler.stop();
    expect(child.kill).toHaveBeenCalled();
  });
});
