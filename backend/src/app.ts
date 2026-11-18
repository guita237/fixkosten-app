import express from 'express';
import cors from 'cors';
import { RequestContext } from '@mikro-orm/core';
import { MikroORM } from '@mikro-orm/postgresql';
import { apiRouter } from './routes';

export function createApp(orm: MikroORM): express.Express {
  const app = express();

  let corsOrigin: string | boolean = true;
  if (process.env.CORS_ORIGIN) {
    corsOrigin = process.env.CORS_ORIGIN;
  }
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json());

  // Eigener EntityManager pro Request
  app.use((_req, _res, next) => RequestContext.create(orm.em, next));

  app.use('/api', apiRouter);
  return app;
}
