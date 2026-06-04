import { processScheduledCallReminders } from './services/scheduled-call-reminders.js';

export async function runScheduledCallReminders() {
  await processScheduledCallReminders();
}
