import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { authRoutes } from './routes/auth.js';
import { adminRoutes } from './routes/admin.js';
import { salesRoutes } from './routes/sales.js';
import { projectHubRoutes } from './routes/projects.js';
import { accountsRoutes } from './routes/accounts.js';
import { productionRoutes } from './routes/production.js';
import { devopsRoutes } from './routes/devops.js';
import { itRoutes } from './routes/it.js';
import { hrRoutes } from './routes/hr.js';
import { notificationRoutes } from './routes/notifications.js';
import { searchRoutes } from './routes/search.js';
import { uploadRoutes } from './routes/uploads.js';

declare global {
  // eslint-disable-next-line no-var
  var __opsFastify: FastifyInstance | undefined;
}

function dbLabel() {
  const url = process.env.DATABASE_URL || '';
  if (url.startsWith('postgres')) return 'postgresql';
  if (url.startsWith('file:')) return 'sqlite';
  return 'unknown';
}

export async function getApp(): Promise<FastifyInstance> {
  if (globalThis.__opsFastify) return globalThis.__opsFastify;

  const app = Fastify({
    logger: process.env.NODE_ENV !== 'production',
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production-32chars',
  });

  app.get('/health', async () => ({ ok: true, version: '2.0.0', db: dbLabel() }));
  app.get('/api/health', async () => ({ ok: true, version: '2.0.0', db: dbLabel() }));

  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(adminRoutes, { prefix: '/api/v1/admin' });
  await app.register(salesRoutes, { prefix: '/api/v1/sales' });
  await app.register(projectHubRoutes, { prefix: '/api/v1/projects' });
  await app.register(accountsRoutes, { prefix: '/api/v1/accounts' });
  await app.register(productionRoutes, { prefix: '/api/v1/production' });
  await app.register(devopsRoutes, { prefix: '/api/v1/devops' });
  await app.register(itRoutes, { prefix: '/api/v1/it' });
  await app.register(hrRoutes, { prefix: '/api/v1/hr' });
  await app.register(notificationRoutes, { prefix: '/api/v1/notifications' });
  await app.register(searchRoutes, { prefix: '/api/v1/search' });
  await app.register(uploadRoutes, { prefix: '/api/v1/uploads' });

  app.get('/api/v1/advanced/commission-preview', async () => ({
    status: 'stub',
    message: 'Commission engine — configure in Phase 5+',
  }));

  await app.ready();
  globalThis.__opsFastify = app;
  return app;
}
