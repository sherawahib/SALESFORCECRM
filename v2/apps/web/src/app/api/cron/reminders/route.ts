import { runScheduledCallReminders } from '@ops/api/cron';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Vercel Cron — call reminders (15 min / 5 min before scheduled calls). */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await runScheduledCallReminders();
  return Response.json({ ok: true });
}
