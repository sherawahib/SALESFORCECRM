import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { Server } from 'socket.io';
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
import { startScheduledCallReminderWorker } from './services/scheduled-call-reminders.js';

const port = Number(process.env.API_PORT || 4000);

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true,
  credentials: true,
});

await app.register(jwt, {
  secret: process.env.JWT_SECRET || 'dev-secret-change-in-production-32chars',
});

app.get('/health', async () => ({ ok: true, version: '2.0.0', db: 'sqlite' }));

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

startScheduledCallReminderWorker();

await app.listen({ port, host: '0.0.0.0' });

const io = new Server(app.server, { cors: { origin: true } });
io.on('connection', (socket) => {
  socket.on('join', (userId: number) => socket.join(`user:${userId}`));
});

console.log(`API http://localhost:${port} | WebSocket enabled`);
