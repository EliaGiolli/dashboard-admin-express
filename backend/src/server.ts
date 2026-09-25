import 'dotenv/config';
import type { Server } from 'node:http';
import app from './app.js';
import { HOST, PORT, RETENTION_DAYS } from './core/config/env.js';
import { seedDefaultConfig } from './features/config/index.js';
import { pruneOlderThan } from './retention.js';

export function startServer(port: number = PORT, host: string = HOST): Server {
  return app.listen(port, host, () => {
    console.log(`🚀 Server is running on http://${host}:${port}`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  await seedDefaultConfig();
  await pruneOlderThan(RETENTION_DAYS);
  startServer();
}
