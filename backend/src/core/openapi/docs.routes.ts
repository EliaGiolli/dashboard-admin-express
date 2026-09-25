import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { buildOpenApiDocument } from './registry.js';

export function createDocsRouter(): Router {
  const router = Router();
  const document = buildOpenApiDocument();
  router.get('/openapi.json', (_req, res) => {
    res.status(200).json(document);
  });
  router.use('/docs', swaggerUi.serve, swaggerUi.setup(document));
  return router;
}
