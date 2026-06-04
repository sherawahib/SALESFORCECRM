import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, getAuth, requirePerm } from '../plugins/authenticate.js';
import { PERMISSIONS } from '@ops/shared';
import { audit } from '../lib/audit.js';
import { createProjectsFromInvoice } from '../services/projects.js';

export async function accountsRoutes(app: FastifyInstance) {
  app.get('/invoices', { preHandler: [authenticate, requirePerm(PERMISSIONS.ACC_INVOICES_READ)] }, async () => {
    return prisma.invoice.findMany({
      include: { client: true, payments: true },
      orderBy: { createdAt: 'desc' },
    });
  });

  app.post('/payments', { preHandler: [authenticate, requirePerm(PERMISSIONS.ACC_PAYMENTS_RECORD)] }, async (request, reply) => {
    const auth = getAuth(request);
    const body = z.object({
      invoiceId: z.number(),
      amount: z.number().positive(),
      method: z.string().default('bank'),
      reference: z.string().optional(),
      notes: z.string().optional(),
    }).parse(request.body);
    const invoice = await prisma.invoice.findUnique({ where: { id: body.invoiceId } });
    if (!invoice) return reply.status(404).send({ error: 'Invoice not found' });

    await prisma.payment.create({
      data: {
        invoiceId: body.invoiceId,
        recordedById: auth.id,
        amount: body.amount,
        method: body.method,
        reference: body.reference,
        notes: body.notes,
      },
    });
    const paid = Number(invoice.amountPaid) + body.amount;
    const total = Number(invoice.total);
    const newStatus = paid >= total ? 'paid' : 'partial';
    const updated = await prisma.invoice.update({
      where: { id: body.invoiceId },
      data: {
        amountPaid: paid,
        status: newStatus,
        paidAt: newStatus === 'paid' ? new Date() : invoice.paidAt,
      },
    });
    if (newStatus === 'paid') await createProjectsFromInvoice(body.invoiceId, invoice.sellerId);
    await audit(auth.id, 'invoice', body.invoiceId, 'payment_recorded', { amount: body.amount }, request.ip);
    return updated;
  });

  app.get('/approvals', { preHandler: [authenticate, requirePerm(PERMISSIONS.ACC_REFUND_APPROVE)] }, async () => {
    return prisma.approvalRequest.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });
  });

  app.post('/approvals/:id/resolve', { preHandler: [authenticate, requirePerm(PERMISSIONS.ACC_REFUND_APPROVE)] }, async (request) => {
    const auth = getAuth(request);
    const id = Number((request.params as { id: string }).id);
    const body = z.object({ approve: z.boolean(), note: z.string().optional() }).parse(request.body);
    const req = await prisma.approvalRequest.findUnique({ where: { id } });
    if (!req) return { error: 'Not found' };
    await prisma.approvalRequest.update({
      where: { id },
      data: {
        status: body.approve ? 'approved' : 'rejected',
        resolvedBy: auth.id,
        resolvedAt: new Date(),
        reason: body.note || req.reason,
      },
    });
    const { freezeProjectAssets } = await import('../services/freeze.js');
    if (body.approve && (req.type === 'refund' || req.type === 'chargeback')) {
      let projectId = req.entityId;
      if (req.entityType === 'invoice') {
        const inv = await prisma.invoice.findUnique({ where: { id: req.entityId } });
        if (inv?.projectId) projectId = inv.projectId;
      } else if (req.entityType === 'project') {
        projectId = req.entityId;
      }
      await freezeProjectAssets(projectId, auth.id, req.type === 'chargeback' ? 'chargeback' : 'refund');
    }
    return { ok: true };
  });

  /** Deprecated for Accounts UI — only Sales Manager initiates via project financial-exception. */
  app.post('/refund-request', { preHandler: [authenticate, requirePerm(PERMISSIONS.SALES_LEADS_MANAGER)] }, async (request) => {
    const auth = getAuth(request);
    const body = z.object({ invoiceId: z.number(), type: z.enum(['refund', 'chargeback']), reason: z.string() }).parse(request.body);
    return prisma.approvalRequest.create({
      data: {
        type: body.type,
        entityType: 'invoice',
        entityId: body.invoiceId,
        requestedBy: auth.id,
        reason: body.reason,
      },
    });
  });

  app.get('/reports/summary', { preHandler: [authenticate, requirePerm(PERMISSIONS.ACC_INVOICES_READ)] }, async () => {
    const invoices = await prisma.invoice.findMany({
      select: { total: true, amountPaid: true, status: true },
    });
    let collected = 0;
    let outstanding = 0;
    let partialBalance = 0;
    for (const inv of invoices) {
      const total = Number(inv.total);
      const paid = Number(inv.amountPaid);
      collected += paid;
      const due = Math.max(0, total - paid);
      if (inv.status === 'partial') partialBalance += due;
      else if (inv.status !== 'paid') outstanding += due;
    }
    return {
      paidTotal: collected,
      unpaidTotal: outstanding,
      partialPaid: partialBalance,
    };
  });
}
