import { EventEmitter } from 'node:events';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import type { ChildProcess } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import { buildPowerShellArgs, runScript } from './runner.js';

const fixture = (name: string) => path.join(import.meta.dirname, '__fixtures__', name);
const onWindows = process.platform === 'win32';

// Real PowerShell, harmless fixture scripts only (see __fixtures__/).
describe.skipIf(!onWindows)('runScript with real PowerShell', () => {
  it('succeeds with exit code 0 and uses the last stdout line as the message', async () => {
    const result = await runScript(fixture('echo-args.ps1'), ['one', 'two']);
    expect(result.success).toBe(true);
    expect(result.message).toBe('["one","two"]');
    expect(result.durationMs).toBeGreaterThan(0);
  });

  it('passes arguments as literal data: no shell and no PowerShell expansion', async () => {
    const sentinel = mkdtempSync(path.join(tmpdir(), 'pcmon-injection-'));
    const hostile = [
      `; Remove-Item -Recurse -Force '${sentinel}'`,
      `$(Remove-Item -Recurse -Force '${sentinel}')`,
      `& rmdir /s /q "${sentinel}"`,
      '`whoami`',
      'a b  c',
    ];
    try {
      const result = await runScript(fixture('echo-args.ps1'), hostile);
      expect(result.success).toBe(true);
      // the directory the payloads try to delete is still there
      expect(existsSync(sentinel)).toBe(true);
      // and the script saw each payload as one plain string
      const received = JSON.parse(result.message) as string[];
      expect(received).toHaveLength(hostile.length);
      expect(received[0]).toContain('Remove-Item');
      expect(received[1]).toMatch(/^\$\(Remove-Item/);
      expect(received[4]).toBe('a b  c');
    } finally {
      rmSync(sentinel, { recursive: true, force: true });
    }
  });

  it('reports failure with the stderr line when the script exits non-zero', async () => {
    const result = await runScript(fixture('fail.ps1'), []);
    expect(result).toMatchObject({ success: false, message: 'Something went wrong' });
  });

  it('reports failure when the script file does not exist', async () => {
    const result = await runScript(fixture('does-not-exist.ps1'), []);
    expect(result.success).toBe(false);
    expect(result.message.length).toBeGreaterThan(0);
  });

  it('kills a hanging script (and its process) at the timeout', async () => {
    const started = Date.now();
    const result = await runScript(fixture('slow.ps1'), [], { timeoutMs: 3_000 });
    expect(result).toMatchObject({ success: false, message: 'Timed out after 3s' });
    expect(Date.now() - started).toBeLessThan(10_000);
    // the PowerShell process must be gone shortly after
    await new Promise((r) => setTimeout(r, 1_500));
    const { execFileSync } = await import('node:child_process');
    const list = execFileSync('powershell.exe', [
      '-NoProfile',
      '-Command',
      "Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -like '*__fixtures__*slow.ps1*' } | Select-Object -ExpandProperty ProcessId",
    ])
      .toString()
      .trim();
    expect(list).toBe('');
  });

  it('caps a flood of output without crashing', async () => {
    const result = await runScript(fixture('noisy.ps1'), [], { maxOutputBytes: 10_000 });
    expect(result.success).toBe(true);
    expect(result.message.length).toBeLessThanOrEqual(500);
  });
});

// Fake child processes: exercise the edge cases without PowerShell.
function fakeChild(pid = 4242) {
  const child = Object.assign(new EventEmitter(), {
    pid,
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: vi.fn(),
  });
  return child as unknown as ChildProcess & { stdout: PassThrough; stderr: PassThrough };
}

describe('runScript contract', () => {
  it('spawns powershell.exe with an argv array, no shell, -File then the args', async () => {
    const child = fakeChild();
    const spawn = vi.fn(() => child);
    const running = runScript('C:\\app\\scripts\\x.ps1', ['-ProcessId', '12'], { spawn });
    child.emit('close', 0);
    await running;
    expect(spawn).toHaveBeenCalledWith(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', 'C:\\app\\scripts\\x.ps1', '-ProcessId', '12'],
      { windowsHide: true, shell: false },
    );
    expect(buildPowerShellArgs('s.ps1', [])).toContain('-File');
  });

  it('never throws when PowerShell cannot be started', async () => {
    const child = fakeChild();
    const running = runScript('x.ps1', [], { spawn: () => child });
    child.emit('error', new Error('spawn powershell.exe ENOENT'));
    await expect(running).resolves.toMatchObject({ success: false, message: expect.stringContaining('ENOENT') });

    const throwing = runScript('x.ps1', [], {
      spawn: () => {
        throw new Error('EPERM');
      },
    });
    await expect(throwing).resolves.toMatchObject({ success: false, message: expect.stringContaining('EPERM') });
  });

  it('kills the whole tree on timeout and ignores a late exit', async () => {
    vi.useFakeTimers();
    try {
      const child = fakeChild(777);
      const killTree = vi.fn();
      const running = runScript('x.ps1', [], { spawn: () => child, killTree, timeoutMs: 5_000 });
      await vi.advanceTimersByTimeAsync(5_000);
      child.emit('close', 0); // exits after being killed: still a failure
      const result = await running;
      expect(killTree).toHaveBeenCalledWith(777);
      expect(result).toMatchObject({ success: false, message: 'Timed out after 5s' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('falls back to stdout, then to the exit code, for the failure message', async () => {
    const a = fakeChild();
    const ra = runScript('x.ps1', [], { spawn: () => a });
    a.stdout.write('Access denied\r\n');
    a.emit('close', 1);
    expect(await ra).toMatchObject({ success: false, message: 'Access denied' });

    const b = fakeChild();
    const rb = runScript('x.ps1', [], { spawn: () => b });
    b.emit('close', 5);
    expect(await rb).toMatchObject({ success: false, message: 'Script exited with code 5' });
  });

  it('says "Done" for a silent success and clips very long messages', async () => {
    const a = fakeChild();
    const ra = runScript('x.ps1', [], { spawn: () => a });
    a.emit('close', 0);
    expect((await ra).message).toBe('Done');

    const b = fakeChild();
    const rb = runScript('x.ps1', [], { spawn: () => b });
    b.stdout.write('y'.repeat(2_000));
    await new Promise((r) => setImmediate(r));
    b.emit('close', 0);
    const message = (await rb).message;
    expect(message).toHaveLength(500);
    expect(message.endsWith('…')).toBe(true);
  });

  it('measures the duration', async () => {
    let t = 1_000;
    const child = fakeChild();
    const running = runScript('x.ps1', [], { spawn: () => child, now: () => t });
    t = 1_250;
    child.emit('close', 0);
    expect((await running).durationMs).toBe(250);
  });
});
