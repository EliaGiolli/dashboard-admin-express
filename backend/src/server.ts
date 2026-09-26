import 'dotenv/config';
import type { Server } from 'node:http';
import app from './app.js';
import { HOST, PORT, RETENTION_DAYS } from './core/config/env.js';
import { prisma } from './core/prisma.js';
import { createWsHub } from './core/ws/index.js';
import { seedDefaultConfig } from './features/config/index.js';
import { createMetricsTicker } from './features/metrics/index.js';
import { pruneOlderThan } from './retention.js';
import { registerShutdown } from './shutdown.js';

export function startServer(port: number = PORT, host: string = HOST): Server {
  return app.listen(port, host, () => {
    console.log(`🚀 Server is running on http://${host}:${port}`);
  });
}

// Startup order: prepare the database, open HTTP, attach the live channel (/ws) to the
// same server, then start the metrics loop that feeds it.
async function main() {
  await seedDefaultConfig();
  await pruneOlderThan(RETENTION_DAYS);

  const server = startServer();
  const hub = createWsHub(server);
  const ticker = createMetricsTicker({
    broadcast: (snapshot) => hub.broadcast('snapshot', snapshot),
  });
  ticker.start();

  // Reverse order: stop producing data, close connections, then the database.
  registerShutdown(async () => {
    await ticker.stop();
    await hub.close();
    await prisma.$disconnect();
  });
}

if (process.env.NODE_ENV !== 'test') {
  await main();
}
