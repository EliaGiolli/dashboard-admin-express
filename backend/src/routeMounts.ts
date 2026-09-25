import type { Router } from 'express';
import { configRouter } from './features/config/index.js';
import { healthRouter } from './features/health/index.js';
import { logsRouter } from './features/logs/index.js';
import { metricsRouter } from './features/metrics/index.js';

export interface RouteMount {
  prefix: string;
  router: Router;
}

// Single source of truth for how feature routers are mounted under /api, used both
// by app.ts to build the Express app and by the OpenAPI coverage test to verify
// every mounted route is documented.
export const routeMounts: RouteMount[] = [
  { prefix: '/health', router: healthRouter },
  { prefix: '/env', router: configRouter },
  { prefix: '/system', router: metricsRouter },
  { prefix: '/logs', router: logsRouter },
];
