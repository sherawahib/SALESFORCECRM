import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, getAuth, requirePerm } from '../plugins/authenticate.js';
import { PERMISSIONS } from '@ops/shared';
import { hasPermission } from '@ops/rbac';
import { audit } from '../lib/audit.js';
import multipart from '@fastify/multipart';
import { assignProjectManager, createLeadWithProject } from '../services/crm-project.js';
import { buildManagerProjectPortfolio } from '../services/manager-portfolio.js';

export async function salesRoutes(app: FastifyInstance) {
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });
  app.get('/leads', { preHandler: [authenticate, requirePerm(PERMISSIONS.SALES_LEADS_READ)] }, async (request) => {
    const auth = getAuth(request);
    const q = (request.query as { search?: string; queue?: string }).search;
    const queue = (request.query as { queue?: string }).queue;
    const isSuper = hasPermission(auth.permissions, PERMISSIONS.SUPER_ALL);
    const isManager = hasPermission(auth.permissions, PERMISSIONS.SALES_LEADS_MANAGER);
    const isPm = hasPermission(auth.permissions, PERMISSIONS.SALES_PROJECTS_PM);

    const where: Record<string, unknown> = { isArchived: false };

    if (queue === 'manager' && (isManager || isSuper)) {
      where.status = 'pending_manager';
    } else if (queue === 'dialer' && isPm) {
      where.assignedSellerId = auth.id;
      where.status = { in: ['assigned_pm', 'contacted', 'active'] };
    } else if (isPm && !isManager && !isSuper) {
      where.assignedSellerId = auth.id;
    } else if (!isSuper && !isManager) {
      where.createdById = auth.id;
    }

    if (q) {
      where.OR = [
        { contactName: { contains: q } },
        { companyName: { contains: q } },
        { phone: { contains: q } },
        { leadCode: { contains: q } },
      ];
    }

    return prisma.lead.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
      take: 100,
      include: {
        seller: { select: { id: true, name: true } },
        project: { select: { id: true, projectCode: true, status: true } },
        _count: { select: { conversations: true } },
      },
    });
  });

  app.get('/leads/:id', { preHandler: [authenticate, requirePerm(PERMISSIONS.SALES_LEADS_READ)] }, async (request) => {
    const id = Number((request.params as { id: string }).id);
    return prisma.lead.findUnique({
      where: { id },
      include: {
        seller: { select: { id: true, name: true } },
        project: { include: { invoices: true, projectManager: true } },
        conversations: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
  });

  /** Lead Finder only — creates lead + project, routes to Sales Manager (no production). */
  app.post('/leads', { preHandler: [authenticate, requirePerm(PERMISSIONS.SALES_LEADS_WRITE)] }, async (request) => {
    const auth = getAuth(request);
    const body = z.object({
      contactName: z.string(),
      companyName: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      source: z.string().optional(),
      notes: z.string().optional(),
      projectCategory: z.enum(['design', 'development', 'combo']).optional(),
    }).parse(request.body);

    const result = await createLeadWithProject({
      createdById: auth.id,
      ...body,
      projectCategory: body.projectCategory,
    });
    await audit(auth.id, 'lead', result.lead.id, 'submitted_to_manager', {}, request.ip);
    return result;
  });

  /** Sales Manager assigns Project Manager. */
  app.post('/leads/:id/assign-pm', { preHandler: [authenticate, requirePerm(PERMISSIONS.SALES_LEADS_MANAGER)] }, async (request) => {
    const auth = getAuth(request);
    const id = Number((request.params as { id: string }).id);
    const body = z.object({ projectManagerId: z.number() }).parse(request.body);
    const lead = await assignProjectManager(id, body.projectManagerId, auth.id);
    await audit(auth.id, 'lead', id, 'assigned_pm', { pmId: body.projectManagerId }, request.ip);
    return lead;
  });

  app.get('/project-managers', { preHandler: [authenticate, requirePerm(PERMISSIONS.SALES_LEADS_MANAGER)] }, async () => {
    return prisma.user.findMany({
      where: { designation: { slug: 'project_manager' }, isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
  });

  app.post('/leads/:id/call', { preHandler: [authenticate, requirePerm(PERMISSIONS.SALES_PROJECTS_PM)] }, async (request) => {
    const auth = getAuth(request);
    const id = Number((request.params as { id: string }).id);
    const body = z.object({
      outcome: z.string(),
      summary: z.string().optional(),
      callbackAt: z.string().optional(),
    }).parse(request.body);
    await prisma.conversation.create({
      data: {
        leadId: id,
        sellerId: auth.id,
        channel: 'call',
        outcome: body.outcome,
        summary: body.summary || `Call: ${body.outcome}`,
      },
    });
    const statusMap: Record<string, string> = {
      no_answer: 'contacted',
      voicemail: 'contacted',
      ready_to_buy: 'active',
      not_interested: 'lost',
      callback_scheduled: 'contacted',
    };
    const update: Record<string, unknown> = { status: statusMap[body.outcome] || 'contacted' };
    if (body.callbackAt) update.callbackAt = new Date(body.callbackAt);
    if (body.outcome === 'not_interested') update.isArchived = true;
    await prisma.lead.update({ where: { id }, data: update });
    return { ok: true };
  });

  /** Only Sales Manager (or Super Admin) can create invoices — always on a project. */
  app.post('/projects/:projectId/invoices', { preHandler: [authenticate, requirePerm(PERMISSIONS.SALES_INVOICES_CREATE)] }, async (request) => {
    const auth = getAuth(request);
    const projectId = Number((request.params as { projectId: string }).projectId);
    const body = z.object({
      items: z.array(z.object({ description: z.string(), quantity: z.number(), unitPrice: z.number() })),
      projectCategory: z.enum(['design', 'development', 'combo']).optional(),
      markPaid: z.boolean().optional(),
      notes: z.string().optional(),
    }).parse(request.body);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { client: true, lead: true },
    });
    if (!project) return { error: 'Project not found' };

    const subtotal = body.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const invNum = `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;
    const pmId = project.projectManagerId ?? auth.id;
    const status = body.markPaid ? 'paid' : 'unpaid';

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: invNum,
        clientId: project.clientId,
        leadId: project.leadId,
        projectId,
        sellerId: pmId,
        projectCategory: body.projectCategory || project.projectCategory,
        subtotal,
        total: subtotal,
        amountPaid: body.markPaid ? subtotal : 0,
        status,
        paidAt: body.markPaid ? new Date() : null,
        notes: body.notes,
        items: {
          create: body.items.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            lineTotal: i.quantity * i.unitPrice,
          })),
        },
      },
      include: { items: true },
    });

    if (body.markPaid) {
      const { createProjectsFromInvoice } = await import('../services/projects.js');
      await createProjectsFromInvoice(invoice.id, pmId);
    }

    await audit(auth.id, 'invoice', invoice.id, 'created_by_manager', { projectId }, request.ip);
    return invoice;
  });

  app.get('/invoices', { preHandler: [authenticate, requirePerm(PERMISSIONS.SALES_INVOICES_READ)] }, async (request) => {
    const auth = getAuth(request);
    const isManager = hasPermission(auth.permissions, PERMISSIONS.SALES_LEADS_MANAGER) || hasPermission(auth.permissions, PERMISSIONS.SUPER_ALL);
    return prisma.invoice.findMany({
      where: isManager ? {} : { project: { projectManagerId: auth.id } },
      include: { client: true, project: { select: { projectCode: true, id: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  });

  /** Sales Manager — all client projects for invoicing / upsell (includes completed — upsells still allowed). */
  app.get('/projects', { preHandler: [authenticate] }, async (request, reply) => {
    const auth = getAuth(request);
    if (
      !hasPermission(auth.permissions, PERMISSIONS.SALES_LEADS_MANAGER) &&
      !hasPermission(auth.permissions, PERMISSIONS.SUPER_ALL)
    ) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    const activeOnly = (request.query as { activeOnly?: string }).activeOnly === '1';
    return prisma.project.findMany({
      where: activeOnly ? { lifecycle: { not: 'completed' } } : undefined,
      include: {
        client: true,
        projectManager: { select: { id: true, name: true } },
        lead: { select: { leadCode: true, status: true } },
        _count: { select: { invoices: true, revisions: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
  });

  /** Sales Manager — ongoing / past / closed projects with last payment date. */
  app.get('/manager/project-portfolio', { preHandler: [authenticate, requirePerm(PERMISSIONS.SALES_LEADS_MANAGER)] }, async () => {
    return buildManagerProjectPortfolio();
  });

  app.get('/scheduled-calls', { preHandler: [authenticate, requirePerm(PERMISSIONS.SALES_PROJECTS_PM)] }, async (request) => {
    const auth = getAuth(request);
    const status = (request.query as { status?: string }).status;
    return prisma.scheduledCall.findMany({
      where: {
        userId: auth.id,
        ...(status ? { status } : {}),
      },
      include: {
        project: { select: { id: true, projectCode: true, title: true, client: { select: { contactName: true } } } },
        lead: { select: { id: true, leadCode: true, contactName: true } },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 100,
    });
  });

  app.post('/scheduled-calls', { preHandler: [authenticate, requirePerm(PERMISSIONS.SALES_PROJECTS_PM)] }, async (request, reply) => {
    const auth = getAuth(request);
    const body = z
      .object({
        projectId: z.number().optional(),
        leadId: z.number().optional(),
        title: z.string().min(1),
        notes: z.string().optional(),
        scheduledAt: z.string(),
      })
      .parse(request.body);

    const scheduledAt = new Date(body.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
      return reply.status(400).send({ error: 'Schedule a call in the future' });
    }

    if (body.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: body.projectId, projectManagerId: auth.id },
      });
      if (!project) return reply.status(403).send({ error: 'Project not assigned to you' });
    }
    if (body.leadId) {
      const lead = await prisma.lead.findFirst({
        where: { id: body.leadId, assignedSellerId: auth.id },
      });
      if (!lead) return reply.status(403).send({ error: 'Lead not in your dialer queue' });
    }

    const call = await prisma.scheduledCall.create({
      data: {
        userId: auth.id,
        projectId: body.projectId,
        leadId: body.leadId,
        title: body.title,
        notes: body.notes,
        scheduledAt,
      },
      include: {
        project: { select: { projectCode: true, client: { select: { contactName: true } } } },
        lead: { select: { leadCode: true, contactName: true } },
      },
    });
    await audit(auth.id, 'scheduled_call', call.id, 'created', { scheduledAt: body.scheduledAt }, request.ip);
    return call;
  });

  app.patch('/scheduled-calls/:id', { preHandler: [authenticate, requirePerm(PERMISSIONS.SALES_PROJECTS_PM)] }, async (request, reply) => {
    const auth = getAuth(request);
    const id = Number((request.params as { id: string }).id);
    const body = z
      .object({
        status: z.enum(['scheduled', 'completed', 'cancelled']).optional(),
        title: z.string().optional(),
        notes: z.string().optional(),
        scheduledAt: z.string().optional(),
      })
      .parse(request.body);

    const existing = await prisma.scheduledCall.findFirst({ where: { id, userId: auth.id } });
    if (!existing) return reply.status(404).send({ error: 'Call not found' });

    const data: Record<string, unknown> = {};
    if (body.status) data.status = body.status;
    if (body.title) data.title = body.title;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.scheduledAt) {
      const scheduledAt = new Date(body.scheduledAt);
      if (Number.isNaN(scheduledAt.getTime())) return reply.status(400).send({ error: 'Invalid date' });
      data.scheduledAt = scheduledAt;
      data.reminder15Sent = false;
      data.reminder5Sent = false;
    }

    return prisma.scheduledCall.update({
      where: { id },
      data,
      include: {
        project: { select: { projectCode: true, client: { select: { contactName: true } } } },
        lead: { select: { leadCode: true, contactName: true } },
      },
    });
  });

  app.get('/my-projects', { preHandler: [authenticate, requirePerm(PERMISSIONS.SALES_PROJECTS_PM)] }, async (request) => {
    const auth = getAuth(request);
    return prisma.project.findMany({
      where: { projectManagerId: auth.id },
      include: { client: true, lead: true, _count: { select: { invoices: true, revisions: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  });

  app.get('/dashboard', { preHandler: [authenticate, requirePerm(PERMISSIONS.SALES_DASHBOARD)] }, async (request) => {
    const auth = getAuth(request);
    const isManager = hasPermission(auth.permissions, PERMISSIONS.SALES_LEADS_MANAGER);
    const isPm = hasPermission(auth.permissions, PERMISSIONS.SALES_PROJECTS_PM);

    if (isManager) {
      const [pending, active, projects] = await Promise.all([
        prisma.lead.count({ where: { status: 'pending_manager' } }),
        prisma.lead.count({ where: { status: 'assigned_pm' } }),
        prisma.project.count({ where: { lifecycle: { not: 'completed' } } }),
      ]);
      return { role: 'manager', pending, active, projects };
    }
    if (isPm) {
      const [projects, openRevisions] = await Promise.all([
        prisma.project.count({ where: { projectManagerId: auth.id, lifecycle: { not: 'completed' } } }),
        prisma.projectRevision.count({ where: { project: { projectManagerId: auth.id }, status: 'client_requested' } }),
      ]);
      return { role: 'pm', projects, openRevisions };
    }
    const submitted = await prisma.lead.count({ where: { createdById: auth.id } });
    return { role: 'finder', submitted };
  });

  /** Phase 1 — bulk CSV import (Lead Finder). Each row → lead + project → manager queue. */
  app.post('/leads/import', { preHandler: [authenticate, requirePerm(PERMISSIONS.SALES_LEADS_WRITE)] }, async (request) => {
    const auth = getAuth(request);
    const file = await request.file();
    if (!file) return { error: 'No file' };
    const buf = await file.toBuffer();
    const text = buf.toString('utf-8');
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return { imported: 0, errors: ['CSV needs header + data rows'] };

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
    const idx = (name: string) => headers.indexOf(name);

    let imported = 0;
    const errors: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      const get = (n: string) => {
        const j = idx(n);
        return j >= 0 ? cols[j] : '';
      };
      const contact = get('contact_name') || get('contact');
      if (!contact) {
        errors.push(`Row ${i + 1}: missing contact_name`);
        continue;
      }
      try {
        await createLeadWithProject({
          createdById: auth.id,
          contactName: contact,
          companyName: get('company_name') || get('company') || undefined,
          email: get('email') || undefined,
          phone: get('phone') || undefined,
          source: get('source') || 'csv_import',
          notes: get('notes') || undefined,
        });
        imported++;
      } catch (e) {
        errors.push(`Row ${i + 1}: ${e instanceof Error ? e.message : 'failed'}`);
      }
    }
    await audit(auth.id, 'lead', 0, 'csv_import', { imported, filename: file.filename }, request.ip);
    return { imported, errors, total: lines.length - 1 };
  });
}
