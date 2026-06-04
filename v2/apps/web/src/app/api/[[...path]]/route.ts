import { proxyToFastify } from '@/server/fastify-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Ctx = { params: Promise<{ path?: string[] }> };

async function handle(request: Request) {
  return proxyToFastify(request);
}

export async function GET(request: Request, _ctx: Ctx) {
  return handle(request);
}
export async function POST(request: Request, _ctx: Ctx) {
  return handle(request);
}
export async function PUT(request: Request, _ctx: Ctx) {
  return handle(request);
}
export async function PATCH(request: Request, _ctx: Ctx) {
  return handle(request);
}
export async function DELETE(request: Request, _ctx: Ctx) {
  return handle(request);
}
