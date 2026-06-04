import { prisma } from './prisma.js';

export async function audit(
  userId: number | null,
  entityType: string,
  entityId: number,
  action: string,
  details?: object,
  ip?: string
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId ?? undefined,
        entityType,
        entityId,
        action,
        details: details ? JSON.stringify(details) : null,
        ipAddress: ip,
      },
    });
  } catch {
    // Don't block login or main flows if audit write fails
  }
}
