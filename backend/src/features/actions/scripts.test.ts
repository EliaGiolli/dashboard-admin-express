import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { actionRegistry, scriptPath } from './registry.js';
import { runScript } from './runner.js';

const onWindows = process.platform === 'win32';

// Parses a script with PowerShell's own parser without running it; returns the errors.
function syntaxErrors(file: string): string[] {
  const command = [
    '$errors = $null',
    `[void][System.Management.Automation.Language.Parser]::ParseFile('${file.replace(/'/g, "''")}', [ref]$null, [ref]$errors)`,
    '$errors | ForEach-Object { $_.Message }',
  ].join('; ');
  const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command]).toString();
  return out.split(/\r?\n/).filter(Boolean);
}

// Scripts are added one task at a time (B-47..B-50); the "all present" check is in B-50.
const implemented = (['flush-dns', 'clear-temp', 'empty-recyclebin'] as const).map((id) => actionRegistry[id]);

describe.skipIf(!onWindows)('action scripts', () => {
  it.each(implemented.map((e) => [e.id, e] as const))('%s exists and has no syntax errors', (_id, entry) => {
    const file = scriptPath(entry);
    expect(existsSync(file)).toBe(true);
    expect(syntaxErrors(file)).toEqual([]);
  });

  // NEVER run without -DryRun here (CLAUDE.md: never empty the Recycle Bin in tests).
  it('empty-recyclebin -DryRun counts the bin without deleting anything', async () => {
    const result = await runScript(scriptPath(actionRegistry['empty-recyclebin']), ['-DryRun']);
    expect(result.success).toBe(true);
    expect(result.message).toMatch(/^(Recycle Bin is already empty|Dry run: would delete \d+ items \([\d.]+ MB\))$/);
  });

  it('the server can never pass -DryRun (or anything else) to empty-recyclebin', () => {
    expect(actionRegistry['empty-recyclebin'].buildArgs({ confirm: true })).toEqual([]);
    expect(actionRegistry['empty-recyclebin'].requiresConfirm).toBe(true);
  });

  // Harmless and explicitly allowed to run for real (CLAUDE.md).
  it('flush-dns really flushes the cache', async () => {
    const result = await runScript(scriptPath(actionRegistry['flush-dns']), []);
    expect(result).toMatchObject({ success: true, message: expect.stringMatching(/^DNS cache flushed/) });
  });
});
