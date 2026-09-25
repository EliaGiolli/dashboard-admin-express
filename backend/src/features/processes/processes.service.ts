import type { ProcessInfo, ProcessList, ProcessListQuery } from '@pc-monitor/shared';
import si from 'systeminformation';

// PID 0 is the "System Idle Process" on Windows: its CPU share is idle time, not load.
const IDLE_PID = 0;

const round1 = (n: number) => Math.round(n * 10) / 10;

export async function listTopProcesses({ sortBy, limit }: ProcessListQuery): Promise<ProcessList> {
  const { list } = await si.processes();
  const processes: ProcessInfo[] = list
    .filter((p) => p.pid !== IDLE_PID)
    .map((p) => ({
      pid: p.pid,
      name: p.name,
      cpuPercent: round1(Math.max(0, p.cpu)),
      memBytes: Math.max(0, p.memRss) * 1024, // systeminformation reports KB
      memPercent: round1(Math.min(100, Math.max(0, p.mem))),
    }));

  const key = sortBy === 'cpu' ? 'cpuPercent' : 'memBytes';
  processes.sort((a, b) => b[key] - a[key] || a.pid - b.pid);
  return { total: processes.length, processes: processes.slice(0, limit) };
}
