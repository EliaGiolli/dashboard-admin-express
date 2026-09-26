import { describe, expect, it } from 'vitest';
import './app.js'; // side effect: registers every feature's OpenAPI paths
import { buildOpenApiDocument, registry } from './core/openapi/index.js';
import { routeMounts } from './routeMounts.js';

interface ExpressRouteLayer {
  route?: {
    path: string;
    methods: Record<string, boolean>;
  };
}

function toOpenApiPath(expressPath: string): string {
  return expressPath.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

describe('OpenAPI coverage', () => {
  it('documents every route mounted under /api', () => {
    const document = buildOpenApiDocument(registry);
    const missing: string[] = [];

    for (const { prefix, router } of routeMounts) {
      const stack = router.stack as unknown as ExpressRouteLayer[];
      for (const layer of stack) {
        if (!layer.route) continue;
        const suffix = layer.route.path === '/' ? '' : layer.route.path;
        const openApiPath = `/api${toOpenApiPath(prefix + suffix)}`;
        const methods = Object.keys(layer.route.methods).filter((m) => layer.route!.methods[m]);
        const documented = document.paths?.[openApiPath];
        for (const method of methods) {
          if (!documented || !(method in documented)) {
            missing.push(`${method.toUpperCase()} ${openApiPath}`);
          }
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it('documents nothing under /api that is not mounted (no stale docs for removed routes)', () => {
    const document = buildOpenApiDocument(registry);
    const mounted = new Set<string>();
    for (const { prefix, router } of routeMounts) {
      for (const layer of router.stack as unknown as ExpressRouteLayer[]) {
        if (!layer.route) continue;
        const suffix = layer.route.path === '/' ? '' : layer.route.path;
        for (const method of Object.keys(layer.route.methods)) {
          mounted.add(`${method.toUpperCase()} /api${toOpenApiPath(prefix + suffix)}`);
        }
      }
    }

    const stale: string[] = [];
    for (const [path, item] of Object.entries(document.paths ?? {})) {
      if (!path.startsWith('/api/')) continue; // /ws is documented but served by Socket.IO
      for (const method of Object.keys(item ?? {})) {
        const key = `${method.toUpperCase()} ${path}`;
        if (!mounted.has(key)) stale.push(key);
      }
    }
    expect(stale).toEqual([]);
  });

  it('marks exactly the admin-guarded routes with the adminKey scheme', () => {
    const document = buildOpenApiDocument(registry);
    expect(document.components?.securitySchemes?.adminKey).toMatchObject({ type: 'apiKey', in: 'header', name: 'x-api-key' });
    const secured = Object.entries(document.paths ?? {}).flatMap(([p, item]) =>
      Object.entries(item ?? {})
        .filter(([, op]) => (op as { security?: unknown[] }).security?.length)
        .map(([method]) => `${method.toUpperCase()} ${p}`),
    );
    expect(secured.sort()).toEqual(['DELETE /api/logs/{id}', 'PATCH /api/logs/{id}']);
  });

  it('documents the Socket.IO channel and its event payloads', () => {
    const document = buildOpenApiDocument(registry);
    const ws = document.paths?.['/ws']?.get;
    expect(ws).toBeDefined();
    // both event payloads appear in the documented frame schema
    const frames = JSON.stringify(ws?.responses?.['101']);
    for (const event of ['snapshot', 'alert']) expect(frames).toContain(`"${event}"`);
    for (const field of ['perCore', 'usedPercent', 'rxBps', 'threshold', 'logId']) expect(frames).toContain(field);
  });
});
