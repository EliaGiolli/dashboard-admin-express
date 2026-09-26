import { spawn, type ChildProcess } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { actionRegistry, scriptPath } from './registry.js';
import { runScript } from './runner.js';

// Only processes these tests start themselves are ever killed (CLAUDE.md). The refusal
// path uses PID 4 (System), which Windows never lets anyone stop anyway.

const onWindows = process.platform === 'win32';
const script = scriptPath(actionRegistry['kill-process']);
const started: ChildProcess[] = [];

// A throwaway process that would idle for a minute.
function throwaway(): ChildProcess {
  const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60_000)'], { windowsHide: true });
  started.push(child);
  return child;
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

afterEach(() => {
  for (const child of started.splice(0)) if (child.exitCode === null) child.kill();
});

describe.skipIf(!onWindows)('kill-process.ps1', () => {
  it('stops a throwaway process and names it', async () => {
    const child = throwaway();
    const exited = new Promise((resolve) => child.once('exit', resolve));

    const result = await runScript(script, actionRegistry['kill-process'].buildArgs({ pid: child.pid! }));

    expect(result).toMatchObject({ success: true, message: `Stopped node (PID ${child.pid})` });
    await exited;
    expect(isAlive(child.pid!)).toBe(false);
  });

  it('refuses a critical system process', async () => {
    const result = await runScript(script, ['-ProcessId', '4']);
    expect(result).toMatchObject({ success: false, message: 'Refusing to stop critical system process System (PID 4)' });
  });

  it('fails cleanly for a PID that does not exist', async () => {
    const child = throwaway();
    const pid = child.pid!;
    child.kill();
    await new Promise((resolve) => child.once('exit', resolve));

    const result = await runScript(script, ['-ProcessId', String(pid)]);
    expect(result).toMatchObject({ success: false, message: `No process with PID ${pid}` });
  });

  it('rejects a PID that is not a positive integer before touching anything', async () => {
    for (const bad of ['0', '-5', 'abc']) {
      const result = await runScript(script, ['-ProcessId', bad]);
      expect(result.success).toBe(false);
    }
  });

  it('fails instead of prompting when the PID is missing', async () => {
    const result = await runScript(script, [], { timeoutMs: 15_000 });
    expect(result.success).toBe(false);
    expect(result.message).not.toMatch(/Timed out/);
  });
});
