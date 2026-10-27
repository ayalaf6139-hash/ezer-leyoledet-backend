import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { corsOrigins } from './config/env';
import { apiRoutes } from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { openApiDocument } from './docs/openapi';

export function createApp() {
  const app = express();

  // ב-Render השרת יושב מאחורי proxy – נדרש כדי לזהות נכון את כתובת ה-IP (להגבלת ניסיונות)
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          // מאפשר ל-Swagger לעבוד גם בפיתוח מקומי ב-http
          upgradeInsecureRequests: null,
        },
      },
    }),
  );

  app.use(
    cors({
      origin: corsOrigins === '*' ? '*' : corsOrigins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Content-Disposition'],
      maxAge: 600,
    }),
  );

  app.use(express.json({ limit: '100kb' }));

  app.get('/', (_req, res) => {
    res.json({
      name: 'Ezer Leyoledet API – עזר ליולדת',
      docs: '/api-docs',
      health: '/api/health',
    });
  });

  // תיעוד API
  app.get('/api-docs/openapi.json', (_req, res) => {
    res.json(openApiDocument);
  });
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: 'עזר ליולדת – API',
      swaggerOptions: { persistAuthorization: true, displayRequestDuration: true, docExpansion: 'none' },
    }),
  );

  app.use('/api', apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
