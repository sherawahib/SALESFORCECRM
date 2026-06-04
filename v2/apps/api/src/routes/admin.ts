import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { authenticate, getAuth, requirePerm } from '../plugins/authenticate.js';
import { PERMISSIONS } from '@ops/shared';
import { audit } from '../lib/audit.js';

export async function adminRoutes(app: FastifyInstance) {
  const guard = [authenticate, requirePerm(PERMISSIONS.ADMIN_DEPARTMENTS)];

  app.get('/departments', { preHandler: guard }, async () => {
    return prisma.department.findMany({
      include: { designations: true, _count: { select: { users: true } } },
      orderBy: { name: 'asc' },
    });
  });

  app.get('/designations', { preHandler: guard }, async () => {
    return prisma.designation.findMany({
      include: { department: true, permissions: { include: { permission: true } } },
      orderBy: [{ departmentId: 'asc' }, { level: 'desc' }],
    });
  });

  app.get('/permissions', { preHandler: guard }, async () => {
    return prisma.permission.findMany({ orderBy: { slug: 'asc' } });
  });

  app.get('/users', { preHandler: [authenticate, requirePerm(PERMISSIONS.IT_USERS_MANAGE)] }, async () => {
    return prisma.user.findMany({
      include: { department: true, designation: true, team: true },
      orderBy: { name: 'asc' },
    });
  });

  app.post('/users', { preHandler: [authenticate, requirePerm(PERMISSIONS.IT_USERS_MANAGE)] }, async (request) => {
    const auth = getAuth(request);
    const body = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(6),
      departmentId: z.number(),
      designationId: z.number(),
      teamId: z.number().optional(),
      managerId: z.number().optional(),
    }).parse(request.body);
    const hash = await bcrypt.hash(body.password, 10);
    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        passwordHash: hash,
        departmentId: body.departmentId,
        designationId: body.designationId,
        teamId: body.teamId,
        managerId: body.managerId,
      },
      include: { department: true, designation: true },
    });
    await audit(auth.id, 'user', user.id, 'created', { email: user.email }, request.ip);
    return user;
  });

  app.get('/settings', { preHandler: [authenticate, requirePerm(PERMISSIONS.ADMIN_SETTINGS)] }, async () => {
    const rows = await prisma.systemSetting.findMany();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  });

  app.put('/settings', { preHandler: [authenticate, requirePerm(PERMISSIONS.ADMIN_SETTINGS)] }, async (request) => {
    const body = z.record(z.string()).parse(request.body);
    for (const [key, value] of Object.entries(body)) {
      await prisma.systemSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    }
    return { ok: true };
  });
}
