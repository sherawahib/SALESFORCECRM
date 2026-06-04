import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, getAuth, requirePerm } from '../plugins/authenticate.js';
import { PERMISSIONS } from '@ops/shared';

export async function itRoutes(app: FastifyInstance) {
  app.get('/audit', { preHandler: [authenticate, requirePerm(PERMISSIONS.IT_AUDIT_READ)] }, async () => {
    return prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  });

  app.get('/email-log', { preHandler: [authenticate, requirePerm(PERMISSIONS.IT_AUDIT_READ)] }, async () => {
    return prisma.emailLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  });

  app.get('/integrations', { preHandler: [authenticate, requirePerm(PERMISSIONS.IT_INTEGRATIONS)] }, async () => {
    return prisma.integrationCredential.findMany({ select: { id: true, slug: true, label: true, updatedAt: true } });
  });

  app.post('/integrations', { preHandler: [authenticate, requirePerm(PERMISSIONS.IT_INTEGRATIONS)] }, async (request) => {
    const auth = getAuth(request);
    const body = z.object({ slug: z.string(), label: z.string(), value: z.string() }).parse(request.body);
    return prisma.integrationCredential.upsert({
      where: { slug: body.slug },
      create: { slug: body.slug, label: body.label, valueEnc: body.value, updatedBy: auth.id },
      update: { label: body.label, valueEnc: body.value, updatedBy: auth.id },
    });
  });

  app.get('/tickets', { preHandler: [authenticate] }, async (request) => {
    const auth = getAuth(request);
    return prisma.supportTicket.findMany({
      where: hasItSupport(auth.permissions) ? {} : { createdById: auth.id },
      orderBy: { createdAt: 'desc' },
    });
  });

  app.post('/tickets', { preHandler: [authenticate] }, async (request) => {
    const auth = getAuth(request);
    const body = z.object({ subject: z.string(), body: z.string(), priority: z.string().optional() }).parse(request.body);
    return prisma.supportTicket.create({
      data: { createdById: auth.id, subject: body.subject, body: body.body, priority: body.priority || 'medium' },
    });
  });
}

function hasItSupport(perms: string[]) {
  return perms.includes(PERMISSIONS.SUPER_ALL) || perms.includes(PERMISSIONS.IT_AUDIT_READ);
}
