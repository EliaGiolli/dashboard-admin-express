import { alertSchema, type Alert, type Snapshot, type ThresholdKey } from '@pc-monitor/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../core/prisma.js';
import { createAlertMonitor, readingsFrom, type AlertMonitorDeps } from './alerts.js';

type Drive = Snapshot['disk']['drives'][number];
const drive = (mount: string, usedPercent: number): Drive => ({ mount, fsType: 'NTFS', size: 100, used: usedPercent, usedPercent });

function snap({ cpu = 10, ram = 10, drives = [drive('C:', 10)] }: { cpu?: number; ram?: number; drives?: Drive[] } = {}): Snapshot {
  return {
    timestamp: '2026-09-26T10:00:00.000Z',
    cpu: { total: cpu, perCore: [cpu], tempC: null },
    ram: { used: ram, total: 100, usedPercent: ram },
    disk: { drives, readBps: null, writeBps: null },
    network: { rxBps: null, txBps: null },
  };
}

// A monitor with fake storage and a controllable clock. Thresholds live in a plain
// object the test can change between checks, like a PATCH would.
function setup(overrides: Partial<AlertMonitorDeps> = {}) {
  let clock = Date.parse('2026-09-26T10:00:00.000Z');
  let nextLogId = 1;
  const thresholds: Partial<Record<ThresholdKey, number>> = { CPU_THRESHOLD: 90, RAM_THRESHOLD: 90, DISK_THRESHOLD: 90 };
  const broadcast = vi.fn<(alert: Alert) => void>();
  const writeLog = vi.fn(async () => ({ id: nextLogId++ }));
  const monitor = createAlertMonitor({
    broadcast,
    writeLog,
    readThresholds: async () => ({ ...thresholds }),
    now: () => clock,
    ...overrides,
  });
  // One ticker cycle: 2 seconds later, check this snapshot.
  async function tick(s: Snapshot) {
    clock += 2_000;
    return monitor.check(s);
  }
  async function ticks(n: number, s: Snapshot) {
    const fired: Alert[] = [];
    for (let i = 0; i < n; i++) fired.push(...(await tick(s)));
    return fired;
  }
  return {
    monitor,
    broadcast,
    writeLog,
    thresholds,
    tick,
    ticks,
    advance: (ms: number) => (clock += ms),
  };
}

describe('readingsFrom', () => {
  it('uses CPU total, RAM percent and the fullest drive', () => {
    const readings = readingsFrom(snap({ cpu: 12, ram: 34, drives: [drive('C:', 50), drive('D:', 95), drive('E:', 70)] }));
    expect(readings).toEqual([
      { metric: 'cpu', value: 12, label: 'CPU usage' },
      { metric: 'ram', value: 34, label: 'RAM usage' },
      { metric: 'disk', value: 95, label: 'Disk D: usage' },
    ]);
  });

  it('has no disk reading when no drive is reported', () => {
    expect(readingsFrom(snap({ drives: [] })).map((r) => r.metric)).toEqual(['cpu', 'ram']);
  });
});

describe('alert monitor: sustained breach', () => {
  it('stays quiet below the threshold', async () => {
    const t = setup();
    expect(await t.ticks(10, snap({ cpu: 89.9 }))).toEqual([]);
  });

  it('does not treat a value equal to the threshold as a breach', async () => {
    const t = setup();
    expect(await t.ticks(10, snap({ cpu: 90 }))).toEqual([]);
  });

  it('fires only on the 3rd consecutive cycle above the threshold', async () => {
    const t = setup();
    expect(await t.tick(snap({ cpu: 95 }))).toEqual([]);
    expect(await t.tick(snap({ cpu: 95 }))).toEqual([]);
    const fired = await t.tick(snap({ cpu: 95 }));
    expect(fired).toHaveLength(1);
    expect(fired[0]).toMatchObject({ metric: 'cpu', value: 95, threshold: 90 });
  });

  it('ignores a short spike: a dip resets the streak', async () => {
    const t = setup();
    await t.ticks(2, snap({ cpu: 100 }));
    await t.tick(snap({ cpu: 20 }));
    expect(await t.ticks(2, snap({ cpu: 100 }))).toEqual([]);
    expect(await t.tick(snap({ cpu: 100 }))).toHaveLength(1);
  });

  it('honours a custom sustain count', async () => {
    const t = setup({ sustainTicks: 1 });
    expect(await t.tick(snap({ ram: 99 }))).toHaveLength(1);
  });
});

describe('alert monitor: debounce', () => {
  it('fires once per breach while the value stays high', async () => {
    const t = setup();
    expect(await t.ticks(50, snap({ cpu: 99 }))).toHaveLength(1);
  });

  it('a long breach without any dip is one alert, even past the cooldown', async () => {
    const t = setup();
    // 600 cycles = 20 minutes above the threshold, four times the cooldown
    expect(await t.ticks(600, snap({ cpu: 99 }))).toHaveLength(1);
  });

  it('re-arms after the value drops, and fires again once the cooldown has passed', async () => {
    const t = setup();
    expect(await t.ticks(3, snap({ cpu: 99 }))).toHaveLength(1);
    await t.tick(snap({ cpu: 10 })); // back to normal: re-armed
    t.advance(5 * 60_000);
    expect(await t.ticks(3, snap({ cpu: 99 }))).toHaveLength(1);
  });

  it('suppresses a new breach inside the cooldown, then fires if still high when it ends', async () => {
    const t = setup();
    expect(await t.ticks(3, snap({ cpu: 99 }))).toHaveLength(1); // fired at T
    await t.tick(snap({ cpu: 10 }));
    // flapping back above within the 5 minutes: nothing
    expect(await t.ticks(10, snap({ cpu: 99 }))).toEqual([]);
    // still above when the cooldown expires: one alert
    t.advance(5 * 60_000);
    expect(await t.tick(snap({ cpu: 99 }))).toHaveLength(1);
  });

  it('keeps a separate cooldown per metric', async () => {
    const t = setup();
    expect(await t.ticks(3, snap({ cpu: 99 }))).toHaveLength(1);
    const fired = await t.ticks(3, snap({ cpu: 99, ram: 95 }));
    expect(fired.map((a) => a.metric)).toEqual(['ram']);
  });

  it('can fire several metrics in the same cycle', async () => {
    const t = setup();
    const fired = await t.ticks(3, snap({ cpu: 99, ram: 99, drives: [drive('C:', 99)] }));
    expect(fired.map((a) => a.metric)).toEqual(['cpu', 'ram', 'disk']);
  });
});

describe('alert monitor: thresholds from config', () => {
  it('applies a changed threshold on the next cycle', async () => {
    const t = setup();
    expect(await t.ticks(3, snap({ cpu: 60 }))).toEqual([]);
    t.thresholds.CPU_THRESHOLD = 50; // lowered via PATCH
    expect(await t.ticks(3, snap({ cpu: 60 }))).toHaveLength(1);
  });

  it('a raised threshold ends the streak', async () => {
    const t = setup();
    await t.ticks(2, snap({ cpu: 95 }));
    t.thresholds.CPU_THRESHOLD = 98;
    expect(await t.tick(snap({ cpu: 95 }))).toEqual([]);
  });

  it('a missing threshold disables only that metric', async () => {
    const t = setup();
    delete t.thresholds.CPU_THRESHOLD;
    const fired = await t.ticks(3, snap({ cpu: 100, ram: 100 }));
    expect(fired.map((a) => a.metric)).toEqual(['ram']);
  });

  it('a drive disappearing breaks the disk streak', async () => {
    const t = setup();
    await t.ticks(2, snap({ drives: [drive('E:', 99)] }));
    await t.tick(snap({ drives: [] }));
    expect(await t.ticks(2, snap({ drives: [drive('E:', 99)] }))).toEqual([]);
  });
});

describe('alert monitor: log and broadcast', () => {
  it('writes a monitor warning log, then broadcasts an alert carrying its id', async () => {
    const t = setup();
    const order: string[] = [];
    t.writeLog.mockImplementation(async () => {
      order.push('log');
      return { id: 42 };
    });
    t.broadcast.mockImplementation(() => void order.push('broadcast'));

    await t.ticks(3, snap({ drives: [drive('C:', 97.5)] }));

    expect(order).toEqual(['log', 'broadcast']);
    expect(t.writeLog).toHaveBeenCalledWith(
      { logMessage: 'Disk C: usage at 97.5% (threshold 90%)', logLevel: 'warning' },
      { source: 'monitor' },
    );
    const alert = t.broadcast.mock.calls[0]![0];
    expect(alertSchema.parse(alert)).toEqual({
      metric: 'disk',
      value: 97.5,
      threshold: 90,
      message: 'Disk C: usage at 97.5% (threshold 90%)',
      logId: 42,
      timestamp: expect.any(String),
    });
  });

  it('does not broadcast when the log cannot be written, and does not retry every cycle', async () => {
    const t = setup();
    t.writeLog.mockRejectedValue(new Error('SQLITE_BUSY'));
    await t.ticks(2, snap({ cpu: 99 }));
    await expect(t.tick(snap({ cpu: 99 }))).rejects.toThrow('SQLITE_BUSY');
    expect(t.broadcast).not.toHaveBeenCalled();
    await t.ticks(5, snap({ cpu: 99 }));
    expect(t.writeLog).toHaveBeenCalledTimes(1);
  });
});

describe('alert monitor: real database', () => {
  beforeEach(async () => {
    await prisma.log.deleteMany();
    await prisma.appConfig.deleteMany();
    await prisma.appConfig.create({ data: { key: 'CPU_THRESHOLD', value: '50', type: 'number' } });
  });

  it('reads thresholds from AppConfig and stores the alert in the Log table', async () => {
    const broadcast = vi.fn();
    const monitor = createAlertMonitor({ broadcast });
    for (let i = 0; i < 3; i++) await monitor.check(snap({ cpu: 80 }));

    const logs = await prisma.log.findMany();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      source: 'monitor',
      logLevel: 'warning',
      logMessage: 'CPU usage at 80% (threshold 50%)',
      actionId: null,
    });
    expect(broadcast).toHaveBeenCalledWith(expect.objectContaining({ metric: 'cpu', logId: logs[0]!.id }));
  });
});
