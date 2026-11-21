import express from 'express';
import cors from 'cors';
import { RequestContext } from '@mikro-orm/core';
import { MikroORM } from '@mikro-orm/postgresql';
import { apiRouter } from './routes';
import { apiLimiter, errorHandler, requestLog, securityHeaders } from './middleware/security';

export function createApp(orm: MikroORM): express.Express {
  const app = express();

  // Hinter Reverse Proxy (Host) + nginx (web-Container): private IPs als Proxy vertrauen,
  // damit req.ip die echte Client-IP ist (für Rate-Limit und Log)
  app.set('trust proxy', process.env.TRUST_PROXY ?? 'loopback, linklocal, uniquelocal');
  app.use(securityHeaders);
  app.use(requestLog);

  let corsOrigin: string | boolean = true;
  if (process.env.CORS_ORIGIN) {
    corsOrigin = process.env.CORS_ORIGIN;
  }
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json());

  // Eigener EntityManager pro Request
  app.use((_req, _res, next) => RequestContext.create(orm.em, next));

  app.use('/api', apiLimiter, apiRouter);
  app.use((_req, res) => {
    res.status(404).json({ error: 'Nicht gefunden' });
  });
  app.use(errorHandler);
  return app;
}
