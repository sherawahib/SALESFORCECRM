import { prisma } from '../lib/prisma.js';
import { audit } from '../lib/audit.js';
import { notify } from '../lib/notify.js';

export async function freezeProjectAssets(projectId: number, userId: number, type: 'chargeback' | 'refund') {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { invoices: true },
  });
  if (!project) return;

  await prisma.project.update({
    where: { id: projectId },
    data: {
      isFrozen: true,
      status: type,
      lifecycle: type,
    },
  });

  for (const inv of project.invoices) {
    if (inv.status === 'paid' || inv.status === 'partial' || inv.status === 'unpaid') {
      await prisma.invoice.update({
        where: { id: inv.id },
        data: { status: type },
      });
    }
  }

  await prisma.projectAssignment.updateMany({
    where: { projectId, status: { in: ['assigned', 'in_progress'] } },
    data: { status: 'cancelled' },
  });

  await audit(userId, 'project', projectId, `CRITICAL_${type.toUpperCase()}_FREEZE`, { type }, undefined);

  const admins = await prisma.user.findMany({
    where: { designation: { slug: { in: ['super_admin', 'sales_manager'] } }, isActive: true },
  });
  for (const a of admins) {
    await notify(a.id, type, `URGENT: ${type}`, `Project ${project.projectCode} frozen.`, `/projects/${projectId}`);
  }
}
