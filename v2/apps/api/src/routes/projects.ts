import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, getAuth, requirePerm } from '../plugins/authenticate.js';
import { PERMISSIONS } from '@ops/shared';
import { hasPermission } from '@ops/rbac';
import {
  listProductionCrewForProject,
  openAdditionalRevisionFromClient,
  openRevisionFromClient,
} from '../services/revisions.js';
import { recalculateProjectBudget } from '../services/budget.js';
import { freezeProjectAssets } from '../services/freeze.js';
import { audit } from '../lib/audit.js';

export async function projectHubRoutes(app: FastifyInstance) {
  app.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const auth = getAuth(request);
    const id = Number((request.params as { id: string }).id);
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        client: true,
        lead: true,
        projectManager: { select: { id: true, name: true, email: true } },
        assignedDesigner: { select: { id: true, name: true } },
        assignedDeveloper: { select: { id: true, name: true } },
        invoices: { include: { items: true, payments: true }, orderBy: { createdAt: 'desc' } },
        revisions: {
          orderBy: { revisionNumber: 'asc' },
          include: {
            files: true,
            assignee: {
              select: { id: true, name: true, designation: { select: { name: true } }, team: { select: { name: true } } },
            },
          },
        },
        assignments: { orderBy: { createdAt: 'desc' } },
        budgetLines: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    const isSuper = hasPermission(auth.permissions, PERMISSIONS.SUPER_ALL);
    const isManager = hasPermission(auth.permissions, PERMISSIONS.SALES_LEADS_MANAGER);
    const isPm = project.projectManagerId === auth.id;
    const canRead =
      isSuper || isManager || isPm || hasPermission(auth.permissions, PERMISSIONS.PROD_PROJECTS_READ);
    if (!canRead) return reply.status(403).send({ error: 'Forbidden' });

    const budget = await recalculateProjectBudget(id);
    return { ...project, budgetRecalculated: budget };
  });

  app.post('/:id/client-revision', { preHandler: [authenticate, requirePerm(PERMISSIONS.SALES_REVISIONS_ASSIGN)] }, async (request, reply) => {
    const auth = getAuth(request);
    const id = Number((request.params as { id: string }).id);
    const body = z
      .object({
        reason: z.string().min(1),
        notes: z.string().optional(),
        discipline: z.enum(['design', 'development']),
        instructions: z.string().min(1),
      })
      .parse(request.body);
    const feedback = body.notes ? `${body.reason}\n\n${body.notes}` : body.reason;
    try {
      return await openRevisionFromClient(id, auth.id, feedback, {
        discipline: body.discipline,
        instructions: body.instructions,
      });
    } catch (e) {
      return reply.status(400).send({ error: e instanceof Error ? e.message : 'Failed' });
    }
  });

  app.get('/:id/production-crew', { preHandler: [authenticate, requirePerm(PERMISSIONS.SALES_REVISIONS_ASSIGN)] }, async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    const auth = getAuth(request);
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return reply.status(404).send({ error: 'Not found' });
    if (project.projectManagerId !== auth.id && !hasPermission(auth.permissions, PERMISSIONS.SUPER_ALL)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    const anyDepartment = (request.query as { anyDepartment?: string }).anyDepartment === '1';
    return listProductionCrewForProject(id, { anyDepartment });
  });

  app.post('/:id/open-additional-revision', { preHandler: [authenticate, requirePerm(PERMISSIONS.SALES_REVISIONS_ASSIGN)] }, async (request, reply) => {
    const auth = getAuth(request);
    const id = Number((request.params as { id: string }).id);
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return reply.status(404).send({ error: 'Not found' });
    if (project.projectManagerId !== auth.id && !hasPermission(auth.permissions, PERMISSIONS.SUPER_ALL)) {
      return reply.status(403).send({ error: 'Only the assigned Project Manager may assign revisions' });
    }
    const body = z
      .object({
        clientFeedback: z.string().min(1),
        discipline: z.enum(['design', 'development']),
        instructions: z.string().min(1),
      })
      .parse(request.body);
    try {
      const rev = await openAdditionalRevisionFromClient(id, auth.id, body.clientFeedback, {
        discipline: body.discipline,
        instructions: body.instructions,
      });
      await audit(auth.id, 'project', id, 'open_additional_revision', { revisionId: rev?.id, discipline: body.discipline }, request.ip);
      return rev;
    } catch (e) {
      return reply.status(400).send({ error: e instanceof Error ? e.message : 'Failed' });
    }
  });

  app.post('/:id/open-revision', { preHandler: [authenticate, requirePerm(PERMISSIONS.SALES_REVISIONS_ASSIGN)] }, async (request, reply) => {
    const auth = getAuth(request);
    const id = Number((request.params as { id: string }).id);
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return reply.status(404).send({ error: 'Not found' });
    if (project.projectManagerId !== auth.id && !hasPermission(auth.permissions, PERMISSIONS.SUPER_ALL)) {
      return reply.status(403).send({ error: 'Only the assigned Project Manager may assign revisions' });
    }
    const body = z
      .object({
        clientFeedback: z.string().min(1),
        discipline: z.enum(['design', 'development']),
        instructions: z.string().min(1),
      })
      .parse(request.body);
    try {
      const rev = await openRevisionFromClient(id, auth.id, body.clientFeedback, {
        discipline: body.discipline,
        instructions: body.instructions,
      });
      await audit(auth.id, 'project', id, 'open_revision', { revisionId: rev?.id, discipline: body.discipline }, request.ip);
      return rev;
    } catch (e) {
      return reply.status(400).send({ error: e instanceof Error ? e.message : 'Failed to open revision' });
    }
  });

  app.post('/:id/revisions/:revId/client-notified', { preHandler: [authenticate, requirePerm(PERMISSIONS.SALES_CLIENT_REVISIONS)] }, async (request) => {
    const revId = Number((request.params as { revId: string }).revId);
    await prisma.projectRevision.update({
      where: { id: revId },
      data: { sellerNotifiedAt: new Date(), notifySeller: false, status: 'client_review' },
    });
    return { ok: true };
  });

  app.post('/:id/upsell', { preHandler: [authenticate, requirePerm(PERMISSIONS.SALES_UPSELL)] }, async (request, reply) => {
    const auth = getAuth(request);
    const projectId = Number((request.params as { id: string }).id);

    const body = z
      .object({
        description: z.string(),
        amount: z.number().positive(),
        markPaid: z.boolean().optional(),
      })
      .parse(request.body);

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return reply.status(404).send({ error: 'Not found' });

    const invNum = `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: invNum,
        clientId: project.clientId,
        leadId: project.leadId,
        projectId,
        sellerId: project.projectManagerId ?? auth.id,
        projectCategory: project.projectCategory,
        isUpsell: true,
        subtotal: body.amount,
        total: body.amount,
        amountPaid: body.markPaid ? body.amount : 0,
        status: body.markPaid ? 'paid' : 'unpaid',
        paidAt: body.markPaid ? new Date() : null,
        notes: body.description,
        items: {
          create: [{ description: body.description, quantity: 1, unitPrice: body.amount, lineTotal: body.amount }],
        },
      },
    });

    await prisma.projectBudgetLine.create({
      data: {
        projectId,
        lineType: 'upsell',
        description: body.description,
        amount: body.amount,
      },
    });
    await recalculateProjectBudget(projectId);
    await audit(auth.id, 'project', projectId, 'upsell_invoice', { invoiceId: invoice.id, amount: body.amount }, request.ip);
    return invoice;
  });

  app.post('/:id/close', { preHandler: [authenticate, requirePerm(PERMISSIONS.SALES_LEADS_MANAGER)] }, async (request, reply) => {
    const auth = getAuth(request);
    const id = Number((request.params as { id: string }).id);
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return reply.status(404).send({ error: 'Not found' });

    await prisma.project.update({
      where: { id },
      data: { status: 'completed', lifecycle: 'completed', completedAt: new Date() },
    });
    await prisma.projectRevision.updateMany({
      where: { projectId: id, status: { notIn: ['resolved', 'closed'] } },
      data: { status: 'closed' },
    });
    if (project.leadId) {
      await prisma.lead.update({ where: { id: project.leadId }, data: { status: 'completed' } });
    }
    await audit(auth.id, 'project', id, 'close_project', {}, request.ip);
    return { ok: true };
  });

  app.post('/:id/financial-exception', { preHandler: [authenticate, requirePerm(PERMISSIONS.SALES_LEADS_MANAGER)] }, async (request) => {
    const auth = getAuth(request);
    const id = Number((request.params as { id: string }).id);
    const body = z.object({ type: z.enum(['refund', 'chargeback']), reason: z.string().min(1) }).parse(request.body);
    await audit(auth.id, 'project', id, 'financial_exception_request', { type: body.type }, request.ip);
    return prisma.approvalRequest.create({
      data: {
        type: body.type,
        entityType: 'project',
        entityId: id,
        requestedBy: auth.id,
        reason: body.reason,
      },
    });
  });

  app.post('/:id/complete', { preHandler: [authenticate, requirePerm(PERMISSIONS.SALES_LEADS_MANAGER)] }, async (request) => {
    const id = Number((request.params as { id: string }).id);
    await prisma.project.update({
      where: { id },
      data: { status: 'completed', lifecycle: 'completed', completedAt: new Date() },
    });
    const p = await prisma.project.findUnique({ where: { id }, select: { leadId: true } });
    if (p?.leadId) await prisma.lead.update({ where: { id: p.leadId }, data: { status: 'completed' } });
    return { ok: true };
  });
}
