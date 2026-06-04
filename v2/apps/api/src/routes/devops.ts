import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, getAuth, requirePerm } from '../plugins/authenticate.js';
import { PERMISSIONS } from '@ops/shared';

export async function devopsRoutes(app: FastifyInstance) {
  app.get('/deployments', { preHandler: [authenticate, requirePerm(PERMISSIONS.OPS_DEPLOYMENTS_READ)] }, async () => {
    return prisma.deploymentRecord.findMany({
      orderBy: { deployedAt: 'desc' },
      take: 100,
      include: { project: { select: { projectCode: true, title: true } } },
    });
  });

  app.post('/deployments', { preHandler: [authenticate, requirePerm(PERMISSIONS.OPS_DEPLOYMENTS_WRITE)] }, async (request) => {
    const auth = getAuth(request);
    const body = z.object({
      projectId: z.number().optional(),
      environment: z.string(),
      repoUrl: z.string().optional(),
      stagingUrl: z.string().optional(),
      version: z.string().optional(),
      notes: z.string().optional(),
    }).parse(request.body);
    return prisma.deploymentRecord.create({
      data: {
        projectId: body.projectId,
        createdById: auth.id,
        environment: body.environment,
        repoUrl: body.repoUrl,
        stagingUrl: body.stagingUrl,
        version: body.version,
        notes: body.notes,
      },
    });
  });
}
