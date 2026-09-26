import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ActionDefinition, ActionId, RunActionRequest } from '@pc-monitor/shared';
import { AppError } from '../../core/errors/appError.js';

/**
 * The only list of things this server can execute.
 *
 * Security model (see CLAUDE.md, "Scripts"):
 * - A request can only name an action *id*. `findAction` looks it up in this object;
 *   an unknown id is a 404. The id is never used to build a path or a command.
 * - `script` is a fixed file name inside `scripts/`, chosen here at build time.
 * - `buildArgs` turns the already-validated request into extra argv entries. Values are
 *   passed as separate argv items to PowerShell's `-File` mode (no shell parsing), and
 *   only typed values (an integer PID) are ever forwarded.
 * - `requiresConfirm` is enforced by the server (409), not just by the UI dialog.
 */

// Next to this file in src/ (tsx) and in dist/ (the build copies the folder).
export const SCRIPTS_DIR = fileURLToPath(new URL('./scripts/', import.meta.url));

// Absolute path of an action's script. Built only from the registry entry.
export function scriptPath(entry: ActionEntry): string {
  return path.join(SCRIPTS_DIR, entry.script);
}

export type ActionEntry = ActionDefinition & {
  script: string;
  buildArgs: (request: RunActionRequest) => string[];
  // Overrides the runner's default (60s) for scripts that legitimately take longer.
  timeoutMs?: number;
};

// PIDs the server never kills, whichever route asks: 0 (System Idle) and 4 (System) are
// the kernel, and killing this server or its parent (tsx/npm) would take the app down.
// Critical Windows processes are also refused by name inside kill-process.ps1.
export function isProtectedPid(pid: number): boolean {
  return pid === 0 || pid === 4 || pid === process.pid || pid === process.ppid;
}

// Actions that act on the whole system take no parameters: a pid is a client mistake.
function noArgs(request: RunActionRequest): string[] {
  if (request.pid !== undefined) throw new AppError('This action does not take a pid', 400);
  return [];
}

export const actionRegistry: Record<ActionId, ActionEntry> = {
  'flush-dns': {
    id: 'flush-dns',
    label: 'Flush DNS cache',
    description: 'Clears the DNS resolver cache. Harmless: names are simply looked up again.',
    risk: 'low',
    requiresConfirm: false,
    target: 'system',
    script: 'flush-dns.ps1',
    buildArgs: noArgs,
  },
  'clear-temp': {
    id: 'clear-temp',
    label: 'Clear temp files',
    description:
      'Deletes files older than 24 hours from your user temp folder. Files in use are skipped. Reports the space freed.',
    risk: 'medium',
    requiresConfirm: false,
    target: 'system',
    script: 'clear-temp.ps1',
    buildArgs: noArgs,
    // Walks the whole temp folder: 1.5 GB / 12k files took 55s on a real machine.
    timeoutMs: 10 * 60_000,
  },
  'empty-recyclebin': {
    id: 'empty-recyclebin',
    label: 'Empty Recycle Bin',
    description: 'Permanently deletes everything in the Recycle Bin on all drives. Cannot be undone.',
    risk: 'high',
    requiresConfirm: true,
    target: 'system',
    script: 'empty-recyclebin.ps1',
    buildArgs: noArgs,
    // Deleting a large bin across drives can take a while.
    timeoutMs: 2 * 60_000,
  },
  'kill-process': {
    id: 'kill-process',
    label: 'Kill process',
    description: 'Force-stops a process by PID. Unsaved work in that program is lost. System processes are refused.',
    risk: 'high',
    requiresConfirm: true,
    target: 'process',
    script: 'kill-process.ps1',
    buildArgs(request) {
      if (request.pid === undefined) throw new AppError('kill-process needs a pid', 400);
      if (isProtectedPid(request.pid)) throw new AppError(`Refusing to kill protected process ${request.pid}`, 403);
      return ['-ProcessId', String(request.pid)];
    },
  },
};

// Own-property lookup only: `id` comes from the URL, so "constructor" or "__proto__"
// must not resolve to something on Object.prototype.
export function findAction(id: string): ActionEntry | undefined {
  return Object.hasOwn(actionRegistry, id) ? actionRegistry[id as ActionId] : undefined;
}

// What GET /api/actions returns: metadata only, never `script` or `buildArgs`.
export function listActionDefinitions(): ActionDefinition[] {
  return Object.values(actionRegistry).map(({ id, label, description, risk, requiresConfirm, target }) => ({
    id,
    label,
    description,
    risk,
    requiresConfirm,
    target,
  }));
}
