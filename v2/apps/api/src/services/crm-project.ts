import { prisma } from '../lib/prisma.js';
import { notify } from '../lib/notify.js';

export function projectCode() {
  return `PRJ-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;
}

export function leadCode() {
  return `LD-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;
}

/** Lead Finder submits lead → pending manager + CRM project (prospect). */
export async function createLeadWithProject(data: {
  createdById: number;
  contactName: string;
  companyName?: string;
  email?: string;
  phone?: string;
  source?: string;
  notes?: string;
  projectCategory?: string;
}) {
  const client = await prisma.client.create({
    data: {
      sellerId: data.createdById,
      contactName: data.contactName,
      companyName: data.companyName,
      email: data.email,
      phone: data.phone,
    },
  });

  const code = projectCode();
  const project = await prisma.project.create({
    data: {
      projectCode: code,
      clientId: client.id,
      title: `${data.companyName || data.contactName} — Opportunity`,
      sellerBrief: data.notes,
      projectCategory: data.projectCategory || 'development',
      lifecycle: 'prospect',
      status: 'prospect',
    },
  });

  const lead = await prisma.lead.create({
    data: {
      leadCode: leadCode(),
      createdById: data.createdById,
      projectId: project.id,
      contactName: data.contactName,
      companyName: data.companyName,
      email: data.email,
      phone: data.phone,
      source: data.source,
      notes: data.notes,
      status: 'pending_manager',
      queueTier: 'manager',
    },
  });

  await prisma.project.update({
    where: { id: project.id },
    data: { leadId: lead.id },
  });

  const managers = await prisma.user.findMany({
    where: { designation: { slug: 'sales_manager' }, isActive: true },
  });
  for (const m of managers) {
    await notify(m.id, 'lead_new', 'New lead for review', `${lead.contactName} (${lead.leadCode})`, '/sales?tab=manager');
  }

  return { lead, project };
}

/** Sales Manager assigns Project Manager. */
export async function assignProjectManager(leadId: number, pmUserId: number, managerId: number) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { project: true } });
  if (!lead?.projectId) throw new Error('Lead has no project');

  await prisma.lead.update({
    where: { id: leadId },
    data: { assignedSellerId: pmUserId, status: 'assigned_pm' },
  });
  await prisma.project.update({
    where: { id: lead.projectId },
    data: {
      projectManagerId: pmUserId,
      status: 'active',
      lifecycle: 'active',
    },
  });

  await notify(pmUserId, 'lead_assigned', 'New client assignment', `You own ${lead.contactName}`, `/projects/${lead.projectId}`);
  return prisma.lead.findUnique({
    where: { id: leadId },
    include: { project: true, seller: { select: { id: true, name: true, email: true } } },
  });
}


export async function activateProjectOnPayment(projectId: number, invoiceTotal: number, category: string) {
  const project = await prisma.project.update({
    where: { id: projectId },
    data: {
      status: 'pending_assignment',
      lifecycle: 'delivery',
      budgetTotal: { increment: invoiceTotal },
      projectCategory: category,
      startedAt: new Date(),
      budgetLines: {
        create: { lineType: 'invoice', description: 'Invoice payment received', amount: invoiceTotal },
      },
    },
    include: { client: true },
  });

  const teamSlug = category === 'design' ? 'design' : 'development';
  const team = await prisma.productionTeam.findFirst({ where: { slug: teamSlug } });
  if (team) {
    await prisma.project.update({ where: { id: projectId }, data: { teamId: team.id } });
    const head = await prisma.user.findFirst({
      where: { department: { slug: 'production' }, designation: { slug: teamSlug === 'design' ? 'design_head' : 'dev_head' } },
    });
    if (head) {
      await prisma.project.update({ where: { id: projectId }, data: { headUserId: head.id } });
      await notify(head.id, 'project_new', 'Delivery started', `${project.projectCode} ready for production`, `/production`);
    }
  }
  const { recalculateProjectBudget } = await import('./budget.js');
  await recalculateProjectBudget(projectId);
  return project;
}
