import { prisma } from '../lib/prisma.js';
import { notify } from '../lib/notify.js';

const TICK_MS = 30_000;
const REMIND_15_MS = 15 * 60 * 1000;
const REMIND_5_MS = 5 * 60 * 1000;
/** Fire reminder if within this window of the target offset (handles tick drift). */
const WINDOW_MS = 90_000;

function formatCallTime(d: Date) {
  return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

async function sendReminder(
  call: { id: number; userId: number; title: string; scheduledAt: Date; projectId: number | null },
  minutesBefore: 15 | 5,
) {
  const when = formatCallTime(call.scheduledAt);
  const link = call.projectId ? `/sales?tab=scheduled-calls` : '/sales?tab=scheduled-calls';
  await notify(
    call.userId,
    'scheduled_call_reminder',
    `Call in ${minutesBefore} minutes`,
    `${call.title} — scheduled for ${when}`,
    link,
  );
  await prisma.scheduledCall.update({
    where: { id: call.id },
    data: minutesBefore === 15 ? { reminder15Sent: true } : { reminder5Sent: true },
  });
}

export async function processScheduledCallReminders() {
  const now = Date.now();
  const horizon = new Date(now + REMIND_15_MS + WINDOW_MS);

  const calls = await prisma.scheduledCall.findMany({
    where: {
      status: 'scheduled',
      scheduledAt: { gte: new Date(now - WINDOW_MS), lte: horizon },
    },
  });

  for (const call of calls) {
    const at = call.scheduledAt.getTime();
    const until = at - now;

    if (!call.reminder15Sent && until <= REMIND_15_MS + WINDOW_MS / 2 && until > REMIND_5_MS) {
      await sendReminder(call, 15);
      continue;
    }
    if (!call.reminder5Sent && until <= REMIND_5_MS + WINDOW_MS / 2 && until > -WINDOW_MS) {
      await sendReminder(call, 5);
    }
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startScheduledCallReminderWorker() {
  if (timer) return;
  void processScheduledCallReminders();
  timer = setInterval(() => {
    void processScheduledCallReminders().catch((e) => console.error('scheduled-call reminders', e));
  }, TICK_MS);
}
