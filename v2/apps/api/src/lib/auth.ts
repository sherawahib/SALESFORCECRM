import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from './prisma.js';

export async function getUserPermissions(userId: number): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      designation: { include: { permissions: { include: { permission: true } } } },
    },
  });
  if (!user) return [];
  return user.designation.permissions.map((dp) => dp.permission.slug);
}

export async function validateUser(email: string, password: string) {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email } },
    include: { department: true, designation: true },
  });
  if (!user || !user.isActive) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  const permissions = await getUserPermissions(user.id);
  return { user, permissions };
}

export function hashRefreshToken(): string {
  return crypto.randomBytes(40).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
