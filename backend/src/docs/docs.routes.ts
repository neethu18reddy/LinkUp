import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openapi } from './openapi.js';
export function documentationRoutes() {
  const router = Router();
  router.get('/v1/openapi.json', (_req, res) => {
    res.set('Cache-Control', 'no-store').json(openapi);
  });
  router.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(openapi, {
      customSiteTitle: 'linkup API documentation',
      swaggerOptions: {
        supportedSubmitMethods: [],
        validatorUrl: null,
        persistAuthorization: false,
        queryConfigEnabled: false,
        defaultModelsExpandDepth: -1,
      },
    }),
  );
  return router;
}
