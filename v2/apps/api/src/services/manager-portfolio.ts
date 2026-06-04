import { prisma } from '../lib/prisma.js';

function lastPaymentAt(
  invoices: {
    paidAt: Date | null;
    payments: { createdAt: Date }[];
  }[],
): Date | null {
  let latest: Date | null = null;
  for (const inv of invoices) {
    if (inv.paidAt && (!latest || inv.paidAt > latest)) latest = inv.paidAt;
    for (const p of inv.payments) {
      if (!latest || p.createdAt > latest) latest = p.createdAt;
    }
  }
  return latest;
}

function projectBucket(lifecycle: string, status: string): 'ongoing' | 'closed' | 'past' {
  if (lifecycle === 'completed' || status === 'completed') return 'closed';
  if (lifecycle === 'delivery' || lifecycle === 'active' || status === 'in_progress' || status === 'open_revision') {
    return 'ongoing';
  }
  return 'past';
}

export async function buildManagerProjectPortfolio() {
  const projects = await prisma.project.findMany({
    include: {
      client: { select: { contactName: true, companyName: true } },
      projectManager: { select: { id: true, name: true } },
      lead: { select: { leadCode: true, status: true } },
      invoices: {
        select: {
          paidAt: true,
          payments: { select: { createdAt: true }, orderBy: { createdAt: 'desc' } },
        },
      },
      _count: { select: { invoices: true, revisions: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 300,
  });

  const rows = projects.map((p) => {
    const lastPay = lastPaymentAt(p.invoices);
    const bucket = projectBucket(p.lifecycle, p.status);
    return {
      id: p.id,
      projectCode: p.projectCode,
      title: p.title,
      clientName: p.client.contactName,
      companyName: p.client.companyName,
      projectManager: p.projectManager,
      lifecycle: p.lifecycle,
      status: p.status,
      projectCategory: p.projectCategory,
      budgetTotal: Number(p.budgetTotal),
      invoiceCount: p._count.invoices,
      revisionCount: p._count.revisions,
      leadCode: p.lead?.leadCode,
      bucket,
      lastPaymentAt: lastPay?.toISOString() ?? null,
    };
  });

  return {
    ongoing: rows.filter((r) => r.bucket === 'ongoing'),
    closed: rows.filter((r) => r.bucket === 'closed'),
    past: rows.filter((r) => r.bucket === 'past'),
    total: rows.length,
  };
}
