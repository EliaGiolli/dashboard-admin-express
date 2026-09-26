import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { ServerToClientEvents, Snapshot } from '@pc-monitor/shared';
import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FRONTEND_ORIGIN } from '../config/env.js';
import { createWsHub, WS_PATH, type WsHub } from './hub.js';

// These tests run a real HTTP server on a random port and real socket.io clients,
// because the security checks live in the handshake, which mocks would skip.

const snapshot: Snapshot = {
  timestamp: '2026-09-26T10:00:00.000Z',
  cpu: { total: 42, perCore: [40, 44], tempC: null },
  ram: { used: 8e9, total: 16e9, usedPercent: 50 },
  disk: { drives: [{ mount: 'C:', fsType: 'NTFS', size: 100, used: 50, usedPercent: 50 }], readBps: 10, writeBps: null },
  network: { rxBps: 1, txBps: 2 },
};

let httpServer: HttpServer;
let hub: WsHub;
let url: string;
const clients: Socket[] = [];

type ClientOptions = { origin?: string; path?: string; transports?: ('websocket' | 'polling')[] };

// Opens a client without auto-reconnect, so a refused handshake fails once and the test ends.
function client({ origin, path = WS_PATH, transports = ['websocket'] }: ClientOptions = {}) {
  const socket: Socket<ServerToClientEvents> = connect(url, {
    path,
    transports,
    reconnection: false,
    timeout: 2_000,
    forceNew: true,
    ...(origin ? { extraHeaders: { Origin: origin } } : {}),
  });
  clients.push(socket);
  return socket;
}

function connected(socket: Socket) {
  return new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });
}

function refused(socket: Socket) {
  return new Promise<Error>((resolve, reject) => {
    socket.once('connect', () => reject(new Error('connection should have been refused')));
    socket.once('connect_error', resolve);
  });
}

// Polls until the server-side count matches: disconnects are noticed asynchronously.
async function waitForCount(expected: number) {
  for (let i = 0; i < 50 && hub.clientCount() !== expected; i++) {
    await new Promise((r) => setTimeout(r, 20));
  }
  expect(hub.clientCount()).toBe(expected);
}

beforeEach(async () => {
  httpServer = createServer();
  hub = createWsHub(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
});

afterEach(async () => {
  for (const socket of clients.splice(0)) socket.disconnect();
  await hub.close();
});

describe('ws hub: handshake security', () => {
  it('accepts the frontend origin', async () => {
    const socket = client({ origin: FRONTEND_ORIGIN });
    await connected(socket);
    await waitForCount(1);
  });

  it('accepts a client without Origin (non-browser, e.g. a local script)', async () => {
    await connected(client());
    await waitForCount(1);
  });

  it('refuses a foreign origin before the connection exists', async () => {
    const err = await refused(client({ origin: 'http://evil.example' }));
    expect(err).toBeInstanceOf(Error);
    expect(hub.clientCount()).toBe(0);
  });

  it('refuses look-alike origins', async () => {
    await refused(client({ origin: `${FRONTEND_ORIGIN}.evil.example` }));
    await refused(client({ origin: 'null' }));
    expect(hub.clientCount()).toBe(0);
  });

  it('does not answer on another path', async () => {
    await refused(client({ path: '/socket.io' }));
    expect(hub.clientCount()).toBe(0);
  });

  it('refuses the HTTP long-polling transport', async () => {
    await refused(client({ transports: ['polling'] }));
    expect(hub.clientCount()).toBe(0);
  });
});

describe('ws hub: broadcasting', () => {
  it('delivers a snapshot to every connected client with the exact payload', async () => {
    const a = client({ origin: FRONTEND_ORIGIN });
    const b = client();
    await Promise.all([connected(a), connected(b)]);

    const received = Promise.all(
      [a, b].map((s) => new Promise<Snapshot>((resolve) => s.once('snapshot', resolve))),
    );
    hub.broadcast('snapshot', snapshot);

    expect(await received).toEqual([snapshot, snapshot]);
  });

  it('delivers alerts on their own event', async () => {
    const socket = client();
    await connected(socket);
    const alert = {
      metric: 'cpu' as const,
      value: 97,
      threshold: 90,
      message: 'CPU at 97% (threshold 90%)',
      logId: 1,
      timestamp: '2026-09-26T10:00:00.000Z',
    };
    const received = new Promise((resolve) => socket.once('alert', resolve));
    hub.broadcast('alert', alert);
    expect(await received).toEqual(alert);
  });

  it('is a no-op when nobody is connected', () => {
    expect(() => hub.broadcast('snapshot', snapshot)).not.toThrow();
  });

  it('stops counting a client after it disconnects', async () => {
    const a = client();
    const b = client();
    await Promise.all([connected(a), connected(b)]);
    await waitForCount(2);
    a.disconnect();
    await waitForCount(1);
  });

  it('ignores events sent by clients (one-way channel)', async () => {
    const socket = client();
    await connected(socket);
    (socket as unknown as Socket).emit('snapshot', { forged: true });
    await new Promise((r) => setTimeout(r, 50));
    expect(socket.connected).toBe(true);
    await waitForCount(1);
  });
});

describe('ws hub: shutdown', () => {
  it('close() disconnects clients and closes the HTTP server', async () => {
    const socket = client();
    await connected(socket);
    const disconnected = new Promise((resolve) => socket.once('disconnect', resolve));

    await hub.close();

    await disconnected;
    expect(httpServer.listening).toBe(false);
  });
});
