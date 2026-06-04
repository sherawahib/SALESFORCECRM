import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authenticate, getAuth } from '../plugins/authenticate.js';
import { hasPermission } from '@ops/rbac';
import { PERMISSIONS } from '@ops/shared';

export async function searchRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [authenticate] }, async (request) => {
    const auth = getAuth(request);
    const q = String((request.query as { q?: string }).q || '').trim();
    if (q.length < 2) return { leads: [], projects: [], invoices: [] };

    const results: { leads: unknown[]; projects: unknown[]; invoices: unknown[] } = {
      leads: [],
      projects: [],
      invoices: [],
    };

    if (hasPermission(auth.permissions, PERMISSIONS.SALES_LEADS_READ) || hasPermission(auth.permissions, PERMISSIONS.SUPER_ALL)) {
      results.leads = await prisma.lead.findMany({
        where: {
          OR: [
            { contactName: { contains: q } },
            { leadCode: { contains: q } },
            { companyName: { contains: q } },
          ],
        },
        take: 10,
      });
    }
    if (hasPermission(auth.permissions, PERMISSIONS.PROD_PROJECTS_READ) || hasPermission(auth.permissions, PERMISSIONS.SUPER_ALL)) {
      results.projects = await prisma.project.findMany({
        where: { OR: [{ projectCode: { contains: q } }, { title: { contains: q } }] },
        take: 10,
      });
    }
    if (hasPermission(auth.permissions, PERMISSIONS.ACC_INVOICES_READ) || hasPermission(auth.permissions, PERMISSIONS.SUPER_ALL)) {
      results.invoices = await prisma.invoice.findMany({
        where: { invoiceNumber: { contains: q } },
        take: 10,
        include: { client: true },
      });
    }
    return results;
  });
}
