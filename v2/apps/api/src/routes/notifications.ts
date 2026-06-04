import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authenticate, getAuth } from '../plugins/authenticate.js';

export async function notificationRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [authenticate] }, async (request) => {
    const auth = getAuth(request);
    return prisma.notification.findMany({
      where: { userId: auth.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  });

  app.post('/read-all', { preHandler: [authenticate] }, async (request) => {
    const auth = getAuth(request);
    await prisma.notification.updateMany({ where: { userId: auth.id }, data: { isRead: true } });
    return { ok: true };
  });
}
