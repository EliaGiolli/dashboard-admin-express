import 'dotenv/config';
import type { Server } from 'node:http';
import app from './app.js';
import { HOST, PORT } from './core/config/env.js';
import { seedDefaultConfig } from './features/config/index.js';

export function startServer(port: number = PORT, host: string = HOST): Server {
  return app.listen(port, host, () => {
    console.log(`🚀 Server is running on http://${host}:${port}`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  await seedDefaultConfig();
  startServer();
}
