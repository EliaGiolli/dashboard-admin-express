import { spawn as nodeSpawn, type ChildProcess } from 'node:child_process';

/**
 * Runs one PowerShell script and reports what happened. The rules here are the
 * backbone of the app's safety, so each one is deliberate:
 *
 * - `spawn` with an argv array and `shell: false`. The script path and every argument
 *   are separate argv items, so nothing is ever parsed by cmd.exe. PowerShell runs in
 *   `-File` mode, which binds the remaining argv items as literal parameter values:
 *   `$(...)`, `;` or quotes inside an argument are data, not code. (Only integer PIDs
 *   are ever forwarded anyway; see registry.ts.)
 * - `-ExecutionPolicy Bypass` applies to this one process only. Windows' default policy
 *   (Restricted) would refuse to run any .ps1 file, including ours; it does not change
 *   the machine's policy.
 * - `-NoProfile -NonInteractive`: the user's profile can't alter the environment, and a
 *   script that unexpectedly prompts fails instead of hanging.
 * - Timeout: after `timeoutMs` the whole process tree is killed (`taskkill /T /F`), so a
 *   stuck script or a child it started can't linger; the run reports failure.
 * - Output is capped per stream, so a runaway script can't fill memory.
 * - It never throws: every outcome (exit code, timeout, spawn failure) becomes a
 *   `{ success, message, durationMs }` result the caller logs.
 *
 * Script contract: print a one-line human summary as the last stdout line and exit 0 on
 * success; write the reason to stderr (or stdout) and exit non-zero on failure.
 */

export type RunOutcome = { success: boolean; message: string; durationMs: number };

type SpawnFn = (command: string, args: string[], options: { windowsHide: boolean; shell: false }) => ChildProcess;

export type RunScriptOptions = {
  timeoutMs?: number;
  maxOutputBytes?: number;
  spawn?: SpawnFn;
  killTree?: (pid: number) => void;
  now?: () => number;
};

export const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_MESSAGE_LENGTH = 500;

// Kills a process and everything it started. child.kill() alone would leave e.g. an
// ipconfig.exe started by the script running. Also argv-array spawn, no shell.
function defaultKillTree(pid: number) {
  const killer = nodeSpawn('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, shell: false });
  killer.on('error', () => {});
}

// Keeps the first `max` bytes of a stream; the rest is dropped.
function collector(max: number) {
  const chunks: Buffer[] = [];
  let size = 0;
  return {
    push(chunk: Buffer) {
      if (size >= max) return;
      const part = chunk.subarray(0, max - size);
      chunks.push(part);
      size += part.length;
    },
    text: () => Buffer.concat(chunks).toString('utf8'),
  };
}

function lastLine(text: string): string | undefined {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.at(-1);
}

const clip = (s: string) => (s.length > MAX_MESSAGE_LENGTH ? `${s.slice(0, MAX_MESSAGE_LENGTH - 1)}…` : s);

export function buildPowerShellArgs(scriptPath: string, args: string[]): string[] {
  return ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, ...args];
}

export function runScript(scriptPath: string, args: string[], options: RunScriptOptions = {}): Promise<RunOutcome> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxOutputBytes = 64 * 1024,
    spawn = nodeSpawn as SpawnFn,
    killTree = defaultKillTree,
    now = Date.now,
  } = options;

  const startedAt = now();
  const elapsed = () => Math.max(0, Math.round(now() - startedAt));

  return new Promise<RunOutcome>((resolve) => {
    let settled = false;
    let timedOut = false;
    // Declared before finish(): spawn can throw synchronously, before the timer exists.
    // Must stay `let`: a `const` declared at the assignment below would be in its
    // temporal dead zone when finish() runs from the spawn failure path (a real bug the
    // runner tests caught).
    // eslint-disable-next-line prefer-const
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (success: boolean, message: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ success, message: clip(message), durationMs: elapsed() });
    };

    let child: ChildProcess;
    try {
      child = spawn('powershell.exe', buildPowerShellArgs(scriptPath, args), { windowsHide: true, shell: false });
    } catch (error) {
      finish(false, `Could not start PowerShell: ${(error as Error).message}`);
      return;
    }

    const stdout = collector(maxOutputBytes);
    const stderr = collector(maxOutputBytes);
    child.stdout?.on('data', (c: Buffer) => stdout.push(c));
    child.stderr?.on('data', (c: Buffer) => stderr.push(c));

    timer = setTimeout(() => {
      timedOut = true;
      if (child.pid !== undefined) killTree(child.pid);
      else child.kill();
      finish(false, `Timed out after ${Math.round(timeoutMs / 1000)}s`);
    }, timeoutMs);

    // e.g. powershell.exe not found. 'close' may not follow, so finish here.
    child.on('error', (error) => finish(false, `Could not start PowerShell: ${error.message}`));

    child.on('close', (code) => {
      if (timedOut) return;
      const out = lastLine(stdout.text());
      if (code === 0) return finish(true, out ?? 'Done');
      finish(false, lastLine(stderr.text()) ?? out ?? `Script exited with code ${code}`);
    });
  });
}
