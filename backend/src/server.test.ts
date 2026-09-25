import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { startServer } from './server.js';

describe('startServer', () => {
  let server: ReturnType<typeof startServer> | undefined;

  afterEach(async () => {
    if (!server) return;
    await new Promise((resolve) => server!.close(resolve));
    server = undefined;
  });

  it('binds to 127.0.0.1 only, never a wildcard/LAN address', async () => {
    server = startServer(0, '127.0.0.1');
    await new Promise((resolve) => server!.once('listening', resolve));

    const address = server.address() as AddressInfo;
    expect(address.address).toBe('127.0.0.1');
  });
});
