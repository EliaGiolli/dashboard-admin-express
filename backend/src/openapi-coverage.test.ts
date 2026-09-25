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
});
