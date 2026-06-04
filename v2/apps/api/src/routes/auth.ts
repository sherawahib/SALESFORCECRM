import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { hashRefreshToken, hashToken, validateUser } from '../lib/auth.js';
import { audit } from '../lib/audit.js';
import { authenticate, getAuth } from '../plugins/authenticate.js';

export async function authRoutes(app: FastifyInstance) {
  app.post('/login', async (request, reply) => {
    try {
      const body = z.object({ email: z.string().min(3), password: z.string().min(1) }).parse(request.body);
      const result = await validateUser(body.email.trim().toLowerCase(), body.password);
      if (!result) return reply.status(401).send({ error: 'Invalid email or password' });

      const accessToken = app.jwt.sign(
        { sub: result.user.id, email: result.user.email },
        { expiresIn: '8h' }
      );
      const refresh = hashRefreshToken();
      await prisma.refreshToken.create({
        data: {
          userId: result.user.id,
          tokenHash: hashToken(refresh),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      await audit(result.user.id, 'user', result.user.id, 'login', {}, request.ip);

      return {
      accessToken,
      refreshToken: refresh,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        department: result.user.department,
        designation: result.user.designation,
      },
      permissions: result.permissions,
    };
    } catch (err) {
      request.log.error(err);
      return reply.status(503).send({
        error: 'Server unavailable. Run: npm run db:push && npm run db:seed (in v2 folder)',
      });
    }
  });

  app.post('/refresh', async (request, reply) => {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(request.body);
    const row = await prisma.refreshToken.findFirst({
      where: { tokenHash: hashToken(refreshToken), expiresAt: { gt: new Date() } },
      include: { user: true },
    });
    if (!row || !row.user.isActive) return reply.status(401).send({ error: 'Invalid refresh token' });
    const accessToken = app.jwt.sign({ sub: row.user.id, email: row.user.email }, { expiresIn: '15m' });
    return { accessToken };
  });

  app.get('/me', { preHandler: [authenticate] }, async (request) => {
    const auth = getAuth(request);
    const user = await prisma.user.findUnique({
      where: { id: auth.id },
      include: { department: true, designation: true },
    });
    return { user, permissions: auth.permissions };
  });
}
