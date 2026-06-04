import { FastifyReply, FastifyRequest } from 'fastify';
import { getUserPermissions } from '../lib/auth.js';

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    const payload = request.user as { sub: number; email: string };
    const permissions = await getUserPermissions(payload.sub);
    (request as FastifyRequest & { authUser: { id: number; email: string; permissions: string[] } }).authUser = {
      id: payload.sub,
      email: payload.email,
      permissions,
    };
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
}

export function requirePerm(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = (request as FastifyRequest & { authUser?: { permissions: string[] } }).authUser;
    if (!auth) return reply.status(401).send({ error: 'Unauthorized' });
    const { hasPermission } = await import('@ops/rbac');
    if (!hasPermission(auth.permissions, permission)) {
      return reply.status(403).send({ error: 'Forbidden', required: permission });
    }
  };
}

export function getAuth(request: FastifyRequest) {
  return (request as FastifyRequest & { authUser: { id: number; email: string; permissions: string[] } }).authUser;
}
