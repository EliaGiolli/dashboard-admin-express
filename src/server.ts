import express from 'express';
import dotenv from 'dotenv';
import {
  type Request,
  type Response,
  type NextFunction,
} from 'express';

import envRouter from './routes/safeEnvRoute.js';
import loggerRouter from './routes/loggerRoute.js';
import cryptoRouter from './routes/cryptoRoute.js';
import systemRouter from './routes/systemRoute.js';

// Load env before anything else
dotenv.config({ path: '../.env' });

const app = express();
app.use(express.json());

// Define routes
app.use('/env', envRouter);
app.use('/system', systemRouter);
app.use('/crypto', cryptoRouter);
app.use('/logs', loggerRouter);
app.use('/:id', loggerRouter);

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'internal error' });
  next();
});

export default app;
