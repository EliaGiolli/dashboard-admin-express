import {
  createLogSchema,
  logIdParamsSchema,
  logSchema,
  messageResponseSchema,
  updateLogSchema,
} from '@pc-monitor/shared';
import { z } from 'zod';
import { errorResponses, json, type ApiRegistry } from '../../core/openapi/index.js';

export function registerLogsDocs(registry: ApiRegistry) {
  registry.registerPath({
    method: 'get',
    path: '/api/logs',
    tags: ['Logs'],
    summary: 'List all logs, newest first',
    responses: {
      200: { description: 'Logs', content: json(z.array(logSchema)) },
      500: errorResponses[500],
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/logs',
    tags: ['Logs'],
    summary: 'Write a log entry',
    request: { body: { required: true, content: json(createLogSchema) } },
    responses: {
      201: {
        description: 'Log created',
        content: json(messageResponseSchema.extend({ newLog: logSchema })),
      },
      400: errorResponses[400],
      500: errorResponses[500],
    },
  });
  registry.registerPath({
    method: 'patch',
    path: '/api/logs/{id}',
    tags: ['Logs'],
    summary: 'Archive or unarchive a log',
    request: { params: logIdParamsSchema, body: { required: true, content: json(updateLogSchema) } },
    responses: {
      200: { description: 'Updated log', content: json(logSchema) },
      400: errorResponses[400],
      404: errorResponses[404],
      500: errorResponses[500],
    },
  });
  registry.registerPath({
    method: 'delete',
    path: '/api/logs/{id}',
    tags: ['Logs'],
    summary: 'Delete a log permanently',
    request: { params: logIdParamsSchema },
    responses: {
      200: { description: 'Log deleted', content: json(messageResponseSchema) },
      400: errorResponses[400],
      404: errorResponses[404],
      500: errorResponses[500],
    },
  });
}
