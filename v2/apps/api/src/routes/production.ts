import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, getAuth, requirePerm } from '../plugins/authenticate.js';
import { PERMISSIONS } from '@ops/shared';
import { hasPermission } from '@ops/rbac';
import { notify } from '../lib/notify.js';
import {
  disciplineForJunior,
  headAssignRevisionCrew,
  listProductionCrewForProject,
  setProjectDefaultCrew,
  updateRevisionCrewStatus,
  type ProductionDiscipline,
} from '../services/revisions.js';

/** Design/dev heads assign juniors on revisions only — not first-time project delivery. */
function canAssignInitialDelivery(designationSlug: string) {
  return ['production_manager', 'super_admin'].includes(designationSlug);
}

export async function productionRoutes(app: FastifyInstance) {
  app.get('/members', { preHandler: [authenticate, requirePerm(PERMISSIONS.PROD_PROJECTS_ASSIGN)] }, async () => {
    return prisma.user.findMany({
      where: { department: { slug: 'production' }, isActive: true },
      select: { id: true, name: true, email: true, teamId: true, designation: { select: { slug: true, name: true } }, team: { select: { slug: true, name: true } } },
      orderBy: { name: 'asc' },
    });
  });

  app.get('/projects', { preHandler: [authenticate, requirePerm(PERMISSIONS.PROD_PROJECTS_READ)] }, async (request) => {
    const auth = getAuth(request);
    const isSuper = hasPermission(auth.permissions, PERMISSIONS.SUPER_ALL);
    return prisma.project.findMany({
      where: isSuper ? {} : undefined,
      include: { client: true, team: true },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  });

  app.get('/projects/:id', { preHandler: [authenticate, requirePerm(PERMISSIONS.PROD_PROJECTS_READ)] }, async (request) => {
    const id = Number((request.params as { id: string }).id);
    return prisma.project.findUnique({
      where: { id },
      include: {
        client: true,
        assignedDesigner: { select: { id: true, name: true } },
        assignedDeveloper: { select: { id: true, name: true } },
        assignments: true,
        revisions: {
          orderBy: { revisionNumber: 'asc' },
          include: {
            files: true,
            assignee: { select: { id: true, name: true } },
          },
        },
        budgetLines: true,
        deployments: true,
      },
    });
  });

  app.post('/projects/:id/assign', { preHandler: [authenticate, requirePerm(PERMISSIONS.PROD_PROJECTS_ASSIGN)] }, async (request, reply) => {
    const auth = getAuth(request);
    const id = Number((request.params as { id: string }).id);
    const actor = await prisma.user.findUnique({
      where: { id: auth.id },
      include: { designation: true },
    });
    if (!actor || !canAssignInitialDelivery(actor.designation.slug)) {
      return reply.status(403).send({
        error: 'Initial delivery assignment is for Production Manager only. Design/Dev heads assign juniors via Head queue when PM opens a revision.',
      });
    }
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return reply.status(404).send({ error: 'Project not found' });
    if (project.status !== 'pending_assignment') {
      return reply.status(400).send({ error: 'Project is not awaiting initial assignment' });
    }
    const body = z.object({
      assigneeId: z.number(),
      instructions: z.string(),
      dueDate: z.string().optional(),
    }).parse(request.body);
    const assignee = await prisma.user.findUnique({
      where: { id: body.assigneeId },
      include: { designation: true, team: true },
    });
    const disc = assignee ? disciplineForJunior(assignee.designation.slug) : null;
    const crewUpdate =
      disc === 'design'
        ? { assignedDesignerId: body.assigneeId, teamId: assignee?.teamId }
        : disc === 'development'
          ? { assignedDeveloperId: body.assigneeId, teamId: assignee?.teamId }
          : {};

    await prisma.projectAssignment.create({
      data: {
        projectId: id,
        assignedById: auth.id,
        assigneeId: body.assigneeId,
        instructions: body.instructions,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
      },
    });
    await prisma.project.update({
      where: { id },
      data: { status: 'in_progress', headUserId: auth.id, ...crewUpdate },
    });
    await notify(body.assigneeId, 'assignment', 'New task', body.instructions, `/production/projects/${id}`);
    return { ok: true };
  });

  app.get('/tasks', { preHandler: [authenticate, requirePerm(PERMISSIONS.PROD_TASKS_READ)] }, async (request) => {
    const auth = getAuth(request);
    return prisma.projectAssignment.findMany({
      where: { assigneeId: auth.id, status: { in: ['assigned', 'in_progress'] } },
      include: { project: { include: { client: true } } },
    });
  });

  /** Junior designer/developer — all revisions assigned to them. */
  app.get('/my-revisions', { preHandler: [authenticate, requirePerm(PERMISSIONS.PROD_TASKS_READ)] }, async (request) => {
    const auth = getAuth(request);
    return prisma.projectRevision.findMany({
      where: { assigneeId: auth.id },
      orderBy: [{ projectId: 'asc' }, { revisionNumber: 'desc' }],
      include: {
        project: {
          select: {
            id: true,
            projectCode: true,
            title: true,
            projectCategory: true,
            client: { select: { contactName: true } },
          },
        },
      },
    });
  });

  /** Junior updates revision status: incomplete | missing_requirement | successfully_done */
  app.post('/revisions/:id/crew-status', { preHandler: [authenticate, requirePerm(PERMISSIONS.PROD_TASKS_SUBMIT)] }, async (request, reply) => {
    const auth = getAuth(request);
    const revId = Number((request.params as { id: string }).id);
    const body = z
      .object({
        status: z.enum(['incomplete', 'missing_requirement', 'successfully_done']),
        notes: z.string().optional(),
      })
      .parse(request.body);
    try {
      return await updateRevisionCrewStatus(revId, auth.id, body.status, body.notes);
    } catch (e) {
      return reply.status(400).send({ error: e instanceof Error ? e.message : 'Failed to update status' });
    }
  });

  app.post('/tasks/:id/submit', { preHandler: [authenticate, requirePerm(PERMISSIONS.PROD_TASKS_SUBMIT)] }, async (request) => {
    const auth = getAuth(request);
    const id = Number((request.params as { id: string }).id);
    const body = z.object({ notes: z.string().optional(), stagingUrl: z.string().optional() }).parse(request.body);
    const assignment = await prisma.projectAssignment.findUnique({ where: { id }, include: { project: true } });
    if (!assignment) return { error: 'Not found' };
    await prisma.projectAssignment.update({
      where: { id },
      data: { status: 'review_pending', submittedAt: new Date(), stagingUrl: body.stagingUrl },
    });
    const openRev = await prisma.projectRevision.findFirst({
      where: {
        projectId: assignment.projectId,
        assigneeId: auth.id,
        status: { in: ['assigned', 'open_revision'] },
      },
      orderBy: { id: 'desc' },
    });

    let revNum: number;
    if (openRev) {
      revNum = openRev.revisionNumber;
      await prisma.projectRevision.update({
        where: { id: openRev.id },
        data: {
          developerNotes: body.notes,
          status: 'review_pending',
          submittedAt: new Date(),
        },
      });
    } else {
      revNum = (await prisma.projectRevision.count({ where: { projectId: assignment.projectId } })) + 1;
      await prisma.projectRevision.create({
        data: {
          projectId: assignment.projectId,
          revisionNumber: revNum,
          openedById: auth.id,
          assigneeId: auth.id,
          developerNotes: body.notes,
          status: 'review_pending',
          submittedAt: new Date(),
        },
      });
    }

    await prisma.project.update({ where: { id: assignment.projectId }, data: { status: 'review_pending' } });
    if (assignment.project.headUserId) {
      await notify(assignment.project.headUserId, 'head_review', 'Submission ready', `Revision v${revNum}`, `/production/projects/${assignment.projectId}`);
    }
    return { ok: true, revisionNumber: revNum };
  });

  app.post('/revisions/:id/approve', { preHandler: [authenticate, requirePerm(PERMISSIONS.PROD_REVISIONS_MANAGE)] }, async (request) => {
    const id = Number((request.params as { id: string }).id);
    const rev = await prisma.projectRevision.findUnique({ where: { id }, include: { project: true } });
    if (!rev) return { error: 'Not found' };
    await prisma.projectRevision.update({
      where: { id },
      data: { status: 'client_review', headApprovedAt: new Date(), notifySeller: true },
    });
    await prisma.project.update({ where: { id: rev.projectId }, data: { status: 'client_review' } });
    if (rev.project.projectManagerId) {
      await notify(rev.project.projectManagerId, 'client_review', 'Deliver to client', `Revision v${rev.revisionNumber}`, `/projects/${rev.projectId}`);
    }
    return { ok: true };
  });

  /** Revisions waiting for design/dev head to pick junior crew. */
  app.get('/head-queue', { preHandler: [authenticate, requirePerm(PERMISSIONS.PROD_REVISIONS_MANAGE)] }, async (request) => {
    const auth = getAuth(request);
    const user = await prisma.user.findUnique({
      where: { id: auth.id },
      include: { designation: true },
    });
    const slug = user?.designation.slug;
    let disciplines: ProductionDiscipline[] = [];
    if (slug === 'design_head' || slug === 'super_admin' || slug === 'production_manager') disciplines.push('design');
    if (slug === 'dev_head' || slug === 'super_admin' || slug === 'production_manager') disciplines.push('development');
    if (disciplines.length === 0) return [];

    return prisma.projectRevision.findMany({
      where: {
        status: 'pending_head_assignment',
        productionDiscipline: { in: disciplines },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        project: {
          include: {
            client: true,
            assignedDesigner: { select: { id: true, name: true } },
            assignedDeveloper: { select: { id: true, name: true } },
          },
        },
      },
      take: 50,
    });
  });

  app.get('/projects/:id/crew', { preHandler: [authenticate] }, async (request, reply) => {
    const auth = getAuth(request);
    if (
      !hasPermission(auth.permissions, PERMISSIONS.PROD_PROJECTS_ASSIGN) &&
      !hasPermission(auth.permissions, PERMISSIONS.PROD_REVISIONS_MANAGE) &&
      !hasPermission(auth.permissions, PERMISSIONS.SUPER_ALL)
    ) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    const id = Number((request.params as { id: string }).id);
    const anyDepartment = (request.query as { anyDepartment?: string }).anyDepartment === '1';
    return listProductionCrewForProject(id, { anyDepartment });
  });

  /** Head assigns junior from pending revision (sets project default for that discipline). */
  app.post('/revisions/:id/head-assign', { preHandler: [authenticate, requirePerm(PERMISSIONS.PROD_REVISIONS_MANAGE)] }, async (request, reply) => {
    const auth = getAuth(request);
    const revId = Number((request.params as { id: string }).id);
    const body = z
      .object({
        assigneeId: z.number().int().positive(),
        instructions: z.string().optional(),
      })
      .parse(request.body);
    try {
      return await headAssignRevisionCrew(revId, auth.id, body);
    } catch (e) {
      return reply.status(400).send({ error: e instanceof Error ? e.message : 'Assignment failed' });
    }
  });

  /** Head changes default designer or developer for a project any time. */
  app.post('/projects/:id/default-crew', { preHandler: [authenticate, requirePerm(PERMISSIONS.PROD_REVISIONS_MANAGE)] }, async (request, reply) => {
    const auth = getAuth(request);
    const projectId = Number((request.params as { id: string }).id);
    const actor = await prisma.user.findUnique({
      where: { id: auth.id },
      include: { designation: true },
    });
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return reply.status(404).send({ error: 'Project not found' });
    if (
      actor &&
      !canAssignInitialDelivery(actor.designation.slug) &&
      project.status === 'pending_assignment'
    ) {
      return reply.status(403).send({
        error: 'Cannot assign default crew on first delivery. Use Head queue after PM opens a revision, or ask Production Manager for initial setup.',
      });
    }
    const body = z
      .object({
        discipline: z.enum(['design', 'development']),
        assigneeId: z.number(),
      })
      .parse(request.body);
    try {
      return await setProjectDefaultCrew(projectId, auth.id, body.discipline, body.assigneeId);
    } catch (e) {
      return reply.status(400).send({ error: e instanceof Error ? e.message : 'Update failed' });
    }
  });

  app.post('/projects/:id/open-revision', { preHandler: [authenticate] }, async (request) => {
    const auth = getAuth(request);
    const projectId = Number((request.params as { id: string }).id);
    const body = z.object({ reason: z.string() }).parse(request.body);
    const revNum = (await prisma.projectRevision.count({ where: { projectId } })) + 1;
    await prisma.projectRevision.create({
      data: {
        projectId,
        revisionNumber: revNum,
        openedById: auth.id,
        openedReason: body.reason,
        status: 'open_revision',
      },
    });
    await prisma.project.update({ where: { id: projectId }, data: { status: 'open_revision' } });
    return { ok: true, revisionNumber: revNum };
  });
}
