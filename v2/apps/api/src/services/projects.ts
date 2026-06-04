import { activateProjectOnPayment } from './crm-project.js';
import { prisma } from '../lib/prisma.js';

/** On invoice paid — advance linked CRM project into production queue (no duplicate project). */
export async function createProjectsFromInvoice(invoiceId: number, _sellerId: number) {
  const inv = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { project: true, client: true },
  });
  if (!inv || inv.status !== 'paid') return;

  if (inv.projectId) {
    await activateProjectOnPayment(inv.projectId, Number(inv.total), inv.projectCategory);
    return;
  }
}
