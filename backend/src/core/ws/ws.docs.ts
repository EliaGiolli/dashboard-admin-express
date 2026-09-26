import { serverMessageSchema } from '@pc-monitor/shared';
import { json, type ApiRegistry } from '../openapi/index.js';
import { WS_PATH } from './hub.js';

// OpenAPI can't describe a WebSocket, so the live channel is documented as a
// read-only entry: how to connect, which events arrive and what they contain.
// "Try it out" can't open it; use a Socket.IO client (see the description).
export function registerWsDocs(registry: ApiRegistry) {
  registry.registerPath({
    method: 'get',
    path: WS_PATH,
    tags: ['Live (Socket.IO)'],
    summary: 'Live metrics channel (Socket.IO, not callable from Swagger UI)',
    description: [
      'Socket.IO server on path `/ws`, **WebSocket transport only** (no long-polling).',
      '',
      '```js',
      "import { io } from 'socket.io-client';",
      "const socket = io('http://127.0.0.1:4317', { path: '/ws', transports: ['websocket'] });",
      "socket.on('snapshot', (s) => console.log(s.cpu.total));",
      "socket.on('alert', (a) => console.log(a.message));",
      '```',
      '',
      'Events (server -> client only; the server ignores anything a client emits). Payload shapes are in the 101 response below:',
      '- `snapshot`: every ~2 seconds, CPU/RAM/disk/network.',
      '- `alert`: a threshold from `/api/config` was exceeded for 3 cycles in a row;',
      '  at most once per breach and once per 5 minutes per metric. Also stored as a `monitor` log.',
      '',
      'The handshake is refused when the browser `Origin` is not the dashboard, because CORS',
      'does not apply to WebSockets. Socket.IO answers any refused handshake with HTTP 400.',
    ].join('\n'),
    responses: {
      101: {
        description: 'Switching protocols. Frames carry events: name = `type`, payload = `data`.',
        content: json(serverMessageSchema),
      },
      400: { description: 'Handshake refused: foreign Origin, or a transport other than websocket' },
    },
  });
}
