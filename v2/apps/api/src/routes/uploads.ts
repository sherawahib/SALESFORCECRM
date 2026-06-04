import { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma.js';
import { authenticate, getAuth } from '../plugins/authenticate.js';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), '../../uploads');

export async function uploadRoutes(app: FastifyInstance) {
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

  app.post('/revision/:projectId', { preHandler: [authenticate] }, async (request) => {
    const auth = getAuth(request);
    const projectId = Number((request.params as { projectId: string }).projectId);
    const data = await request.file();
    if (!data) return { error: 'No file' };

    const dir = path.join(UPLOAD_DIR, 'revisions', String(projectId));
    fs.mkdirSync(dir, { recursive: true });
    const safeName = data.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const stored = `${Date.now()}_${safeName}`;
    const filePath = path.join(dir, stored);
    const buf = await data.toBuffer();
    fs.writeFileSync(filePath, buf);

    const rev = await prisma.projectRevision.findFirst({
      where: { projectId },
      orderBy: { revisionNumber: 'desc' },
    });

    const record = await prisma.revisionFile.create({
      data: {
        projectId,
        revisionId: rev?.id,
        uploadedById: auth.id,
        originalName: data.filename,
        filePath: `revisions/${projectId}/${stored}`,
        mimeType: data.mimetype,
        fileSize: buf.length,
      },
    });
    return record;
  });
}
