import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { actionRegistry, scriptPath } from './registry.js';
import { runScript } from './runner.js';

// clear-temp.ps1 deletes files, so it NEVER runs against the real %TEMP% here: every
// test passes -Path pointing at a fresh sandbox folder. (The server itself never passes
// -Path; see registry.ts.)

const onWindows = process.platform === 'win32';
const script = scriptPath(actionRegistry['clear-temp']);
const TWO_DAYS_AGO = new Date(Date.now() - 48 * 3600_000);

let sandbox: string;
let outside: string;

function file(rel: string, bytes: number, old: boolean, base = sandbox) {
  const full = path.join(base, rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, Buffer.alloc(bytes, 1));
  if (old) utimesSync(full, TWO_DAYS_AGO, TWO_DAYS_AGO);
  return full;
}
const ageDir = (full: string) => utimesSync(full, TWO_DAYS_AGO, TWO_DAYS_AGO);
const clean = (dir = sandbox) => runScript(script, ['-Path', dir]);

beforeEach(() => {
  sandbox = mkdtempSync(path.join(tmpdir(), 'pcmon-cleartemp-'));
  outside = mkdtempSync(path.join(tmpdir(), 'pcmon-outside-'));
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
});

describe.skipIf(!onWindows)('clear-temp.ps1 (sandbox only)', () => {
  it('deletes files older than 24h, keeps recent ones, and reports the space freed', async () => {
    const old1 = file('old1.tmp', 1024 * 1024, true);
    const old2 = file('old2.log', 512 * 1024, true);
    const recent = file('recent.tmp', 1000, false);

    const result = await clean();

    expect(result).toMatchObject({ success: true, message: 'Freed 1.5 MB from 2 files (0 skipped: in use or protected)' });
    expect(existsSync(old1)).toBe(false);
    expect(existsSync(old2)).toBe(false);
    expect(existsSync(recent)).toBe(true);
  });

  it('removes old folders that end up empty, keeps folders that still hold recent files', async () => {
    file('oldDir/a.tmp', 10, true);
    file('oldDir/nested/b.tmp', 10, true);
    ageDir(path.join(sandbox, 'oldDir/nested'));
    ageDir(path.join(sandbox, 'oldDir'));
    const keep = file('mixedDir/new.tmp', 10, false);
    file('mixedDir/old.tmp', 10, true);
    ageDir(path.join(sandbox, 'mixedDir'));

    const result = await clean();

    expect(result.success).toBe(true);
    expect(existsSync(path.join(sandbox, 'oldDir'))).toBe(false);
    expect(existsSync(keep)).toBe(true);
    expect(existsSync(path.join(sandbox, 'mixedDir/old.tmp'))).toBe(false);
  });

  it('deletes old read-only and hidden files too', async () => {
    const ro = file('readonly.tmp', 10, true);
    const { execFileSync } = await import('node:child_process');
    execFileSync('attrib', ['+R', '+H', ro]);
    const result = await clean();
    expect(result.message).toContain('from 1 files');
    expect(existsSync(ro)).toBe(false);
  });

  it('skips a locked file without failing', async () => {
    const locked = file('locked.tmp', 10, true);
    file('free.tmp', 10, true);
    // A separate process holds the file open with no sharing, like a running program would.
    const holder = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `$f = [IO.File]::Open('${locked}', 'Open', 'Read', 'None'); Write-Output 'locked'; Start-Sleep -Seconds 30`,
      ],
      { windowsHide: true },
    );
    try {
      await new Promise<void>((resolve) => holder.stdout.once('data', () => resolve()));
      const result = await clean();
      expect(result).toMatchObject({ success: true, message: expect.stringContaining('from 1 files (1 skipped') });
      expect(existsSync(locked)).toBe(true);
    } finally {
      // wait until the lock is really released, or cleanup can't delete the sandbox
      const exited = new Promise((resolve) => holder.once('exit', resolve));
      holder.kill();
      await exited;
    }
  });

  it('never follows a junction: files it points to survive', async () => {
    const precious = file('precious.docx', 10, true, outside);
    const link = path.join(sandbox, 'link-to-documents');
    symlinkSync(outside, link, 'junction');

    const result = await clean();

    expect(result.success).toBe(true);
    expect(existsSync(precious)).toBe(true);
    expect(existsSync(link)).toBe(true); // the link itself is left alone too
  });

  it('fails cleanly on a missing folder and deletes nothing', async () => {
    const result = await clean(path.join(sandbox, 'does-not-exist'));
    expect(result).toMatchObject({ success: false, message: expect.stringContaining('Temp folder not found') });
  });

  it('refuses a -MinAgeHours outside 0-8760', async () => {
    const f = file('old.tmp', 10, true);
    const result = await runScript(script, ['-Path', sandbox, '-MinAgeHours', '-1']);
    expect(result.success).toBe(false);
    expect(existsSync(f)).toBe(true);
  });
});
