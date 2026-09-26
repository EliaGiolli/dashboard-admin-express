// Prints the live Socket.IO stream of a running backend: one line per `snapshot`
// (with the gap since the previous one) and every `alert`.
//   npm run live -w backend                 # http://127.0.0.1:4317
//   npm run live -w backend -- 15           # stop after 15 seconds
import { serverEventSchemas, type ServerToClientEvents } from '@pc-monitor/shared';
import { io, type Socket } from 'socket.io-client';

const url = process.env.LIVE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 4317}`;
const seconds = Number(process.argv[2]) || 0;

const socket: Socket<ServerToClientEvents> = io(url, { path: '/ws', transports: ['websocket'] });
const mb = (bytes: number | null) => (bytes === null ? '  n/a' : `${(bytes / 1e6).toFixed(2)}MB/s`);
let last = 0;

socket.on('connect', () => console.log(`connected to ${url}/ws`));
socket.on('connect_error', (e) => console.log(`connection failed: ${e.message}`));
socket.on('disconnect', (reason) => console.log(`disconnected: ${reason}`));

socket.on('snapshot', (raw) => {
  const parsed = serverEventSchemas.snapshot.safeParse(raw);
  if (!parsed.success) return console.log('invalid snapshot payload', parsed.error.issues);
  const s = parsed.data;
  const now = Date.now();
  const gap = last ? `+${((now - last) / 1000).toFixed(1)}s` : 'first';
  last = now;
  const disk = s.disk.drives.map((d) => `${d.mount}${d.usedPercent}%`).join(' ');
  console.log(
    `${s.timestamp.slice(11, 19)} ${gap.padStart(6)}  cpu ${String(s.cpu.total).padStart(5)}% (${s.cpu.perCore.length} cores, temp ${s.cpu.tempC ?? 'N/A'})` +
      `  ram ${s.ram.usedPercent}%  disk ${disk} r ${mb(s.disk.readBps)} w ${mb(s.disk.writeBps)}` +
      `  net rx ${mb(s.network.rxBps)} tx ${mb(s.network.txBps)}`,
  );
});

socket.on('alert', (raw) => {
  const parsed = serverEventSchemas.alert.safeParse(raw);
  console.log(parsed.success ? `ALERT ${parsed.data.message} (log #${parsed.data.logId})` : 'invalid alert payload');
});

if (seconds > 0) {
  setTimeout(() => {
    socket.close();
  }, seconds * 1000);
}
