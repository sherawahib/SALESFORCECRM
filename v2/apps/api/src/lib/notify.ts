import { prisma } from './prisma.js';

export async function notify(userId: number, type: string, title: string, message: string, link?: string) {
  await prisma.notification.create({
    data: { userId, type, title, message, link },
  });
}
