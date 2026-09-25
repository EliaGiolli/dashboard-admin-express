import 'dotenv/config';
import type { Server } from 'node:http';
import app from './app.js';
import { HOST, PORT } from './core/config/env.js';

export function startServer(port: number = PORT, host: string = HOST): Server {
  return app.listen(port, host, () => {
    console.log(`🚀 Server is running on http://${host}:${port}`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
