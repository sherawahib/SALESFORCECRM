import { prisma } from '../lib/prisma.js';

/** Budget = sum of paid primary + paid upsell invoices on project (blueprint formula). */
export async function recalculateProjectBudget(projectId: number) {
  const invoices = await prisma.invoice.findMany({
    where: {
      projectId,
      status: { in: ['paid', 'partial'] },
    },
  });
  let total = 0;
  for (const inv of invoices) {
    total += Number(inv.status === 'paid' ? inv.total : inv.amountPaid);
  }
  await prisma.project.update({
    where: { id: projectId },
    data: { budgetTotal: total },
  });
  return total;
}
