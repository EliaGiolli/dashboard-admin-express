import type { Alert, AlertMetric, CreateLog, LogAudit, Snapshot, ThresholdKey } from '@pc-monitor/shared';
import { getThresholds } from '../config/index.js';
import { LoggerService } from '../logs/index.js';

/**
 * Threshold alerts. Runs once per ticker cycle, right after the snapshot is broadcast.
 *
 * Rules (each one is covered by alerts.test.ts):
 *
 * - A metric is "over" when its value is strictly above its threshold. Metrics:
 *   CPU total %, RAM used %, and disk = the fullest drive's used %.
 * - Sustained: it must be over for `sustainTicks` consecutive cycles (default 3, ~6s)
 *   before an alert fires. CPU routinely spikes to 100% for a second when an app starts;
 *   that is not worth a notification.
 * - Once per breach: after firing, the metric is "disarmed" and stays silent while it
 *   remains over the threshold. It re-arms as soon as the value drops back to or below
 *   the threshold.
 * - Cooldown: at most one alert per metric every `cooldownMs` (default 5 min), so a
 *   value flapping around the threshold can't flood the log. A metric that re-armed
 *   (dipped) during the cooldown and is still over when it ends fires then. A metric
 *   that never dipped stays disarmed: one long breach is one alert, however long.
 * - Thresholds are re-read from AppConfig every cycle, so a PATCH takes effect on the
 *   next tick without a restart. A missing or invalid threshold disables that metric
 *   (its streak resets) and never raises an error.
 * - Order per alert: write the Log row first (source "monitor", level "warning"), then
 *   broadcast the `alert` event carrying the new log id, so the UI can link to it.
 *   If the log write fails the error propagates (the ticker reports it) and nothing is
 *   broadcast; the metric still counts as fired, so a broken database can't turn into
 *   a retry every 2 seconds.
 */

export const ALERT_SUSTAIN_TICKS = 3;
export const ALERT_COOLDOWN_MS = 5 * 60_000;

const THRESHOLD_KEY: Record<AlertMetric, ThresholdKey> = {
  cpu: 'CPU_THRESHOLD',
  ram: 'RAM_THRESHOLD',
  disk: 'DISK_THRESHOLD',
};

type Reading = { metric: AlertMetric; value: number; label: string };

// What each metric measures in this snapshot. Disk is absent when no drive is reported.
export function readingsFrom(snapshot: Snapshot): Reading[] {
  const readings: Reading[] = [
    { metric: 'cpu', value: snapshot.cpu.total, label: 'CPU usage' },
    { metric: 'ram', value: snapshot.ram.usedPercent, label: 'RAM usage' },
  ];
  const fullest = snapshot.disk.drives.reduce<Snapshot['disk']['drives'][number] | null>(
    (max, d) => (max === null || d.usedPercent > max.usedPercent ? d : max),
    null,
  );
  if (fullest) readings.push({ metric: 'disk', value: fullest.usedPercent, label: `Disk ${fullest.mount} usage` });
  return readings;
}

type MetricState = { streak: number; armed: boolean; lastFiredAt: number | null };

export type AlertMonitorDeps = {
  broadcast: (alert: Alert) => void;
  readThresholds?: () => Promise<Partial<Record<ThresholdKey, number>>>;
  writeLog?: (log: CreateLog, audit: LogAudit) => Promise<{ id: number }>;
  now?: () => number;
  sustainTicks?: number;
  cooldownMs?: number;
};

export type AlertMonitor = {
  /** Evaluates one snapshot; resolves with the alerts that fired (usually none). */
  check(snapshot: Snapshot): Promise<Alert[]>;
};

export function createAlertMonitor({
  broadcast,
  readThresholds = getThresholds,
  writeLog = (log, audit) => new LoggerService().writeLogs(log, audit),
  now = Date.now,
  sustainTicks = ALERT_SUSTAIN_TICKS,
  cooldownMs = ALERT_COOLDOWN_MS,
}: AlertMonitorDeps): AlertMonitor {
  const state: Record<AlertMetric, MetricState> = {
    cpu: { streak: 0, armed: true, lastFiredAt: null },
    ram: { streak: 0, armed: true, lastFiredAt: null },
    disk: { streak: 0, armed: true, lastFiredAt: null },
  };

  return {
    async check(snapshot) {
      const thresholds = await readThresholds();
      const at = now();
      const due: { reading: Reading; threshold: number }[] = [];

      // 1) Update every metric's state first (pure bookkeeping, no I/O).
      const seen = new Set<AlertMetric>();
      for (const reading of readingsFrom(snapshot)) {
        seen.add(reading.metric);
        const s = state[reading.metric];
        const threshold = thresholds[THRESHOLD_KEY[reading.metric]];

        if (threshold === undefined || reading.value <= threshold) {
          // Below (or no threshold configured): the breach, if any, is over.
          s.streak = 0;
          s.armed = true;
          continue;
        }

        s.streak++;
        const cooledDown = s.lastFiredAt === null || at - s.lastFiredAt >= cooldownMs;
        if (s.streak >= sustainTicks && s.armed && cooledDown) {
          s.armed = false;
          s.lastFiredAt = at;
          due.push({ reading, threshold });
        }
      }
      // A metric missing from this snapshot (e.g. no drives reported) breaks its streak.
      for (const metric of Object.keys(state) as AlertMetric[]) {
        if (!seen.has(metric)) state[metric].streak = 0;
      }

      // 2) Then persist and broadcast what fired.
      const fired: Alert[] = [];
      for (const { reading, threshold } of due) {
        const message = `${reading.label} at ${reading.value}% (threshold ${threshold}%)`;
        const log = await writeLog({ logMessage: message, logLevel: 'warning' }, { source: 'monitor' });
        const alert: Alert = {
          metric: reading.metric,
          value: reading.value,
          threshold,
          message,
          logId: log.id,
          timestamp: new Date(at).toISOString(),
        };
        broadcast(alert);
        fired.push(alert);
      }
      return fired;
    },
  };
}
