import { spawn as nodeSpawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';

export type DiskIo = { readBps: number; writeBps: number };
type RawReading = { read: number; write: number; ts100ns: number };

// systeminformation has no disk throughput on Windows (disksIO/fsStats return null), and
// perf counter names are localized (typeperf/Get-Counter break on non-English Windows).
// WMI class and property names are not localized, so one long-lived PowerShell loop prints
// the cumulative byte counters every 2s and the rate is computed here from the deltas.
// Fixed script, argv array, no user input. $ErrorActionPreference='Stop' makes the loop
// exit when the stdout pipe breaks, so it cannot outlive the server.
const WINDOWS_DISK_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  'while ($true) {',
  `  $d = Get-CimInstance -ClassName Win32_PerfRawData_PerfDisk_PhysicalDisk -Filter "Name='_Total'"`,
  `  [Console]::Out.WriteLine(('{0} {1} {2}' -f $d.DiskReadBytesPersec, $d.DiskWriteBytesPersec, $d.Timestamp_Sys100NS))`,
  '  Start-Sleep -Seconds 2',
  '}',
].join('\n');

export function parseRawLine(line: string): RawReading | null {
  const parts = line.trim().split(/\s+/);
  if (parts.length !== 3) return null;
  const [read, write, ts100ns] = parts.map(Number) as [number, number, number];
  if (![read, write, ts100ns].every(Number.isFinite)) return null;
  return { read, write, ts100ns };
}

// Rate between two cumulative readings; null if time didn't advance or a counter went back.
export function rateBetween(prev: RawReading, next: RawReading): DiskIo | null {
  const seconds = (next.ts100ns - prev.ts100ns) / 1e7;
  const read = next.read - prev.read;
  const write = next.write - prev.write;
  if (seconds <= 0 || read < 0 || write < 0) return null;
  return { readBps: Math.round(read / seconds), writeBps: Math.round(write / seconds) };
}

type SamplerOptions = {
  spawn?: (command: string, args: string[]) => ChildProcessWithoutNullStreams;
  now?: () => number;
  staleMs?: number; // a rate older than this is reported as null
  restartDelayMs?: number; // minimum wait before respawning a dead sampler
};

export function createWindowsDiskIoSampler({
  spawn = (command, args) => nodeSpawn(command, args, { windowsHide: true }),
  now = Date.now,
  staleMs = 10_000,
  restartDelayMs = 30_000,
}: SamplerOptions = {}) {
  let child: ChildProcessWithoutNullStreams | null = null;
  let previous: RawReading | null = null;
  let latest: { io: DiskIo; at: number } | null = null;
  let lastStart = -Infinity;

  function start() {
    if (child || now() - lastStart < restartDelayMs) return;
    lastStart = now();
    previous = null;
    const proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', WINDOWS_DISK_SCRIPT]);
    child = proc;
    createInterface({ input: proc.stdout }).on('line', (line) => {
      const reading = parseRawLine(line);
      if (!reading) return;
      const io = previous ? rateBetween(previous, reading) : null;
      if (io) latest = { io, at: now() };
      previous = reading;
    });
    proc.stderr.resume(); // drain; failures show up as a missing rate
    proc.on('error', () => {}); // spawn failure is followed by 'close'
    proc.on('close', () => {
      if (child === proc) child = null;
    });
  }

  return {
    // Starts the sampler if needed and returns the most recent rate, or null.
    read(): DiskIo | null {
      start();
      if (!latest || now() - latest.at > staleMs) return null;
      return latest.io;
    },
    stop() {
      child?.kill();
      child = null;
      latest = null;
    },
  };
}
