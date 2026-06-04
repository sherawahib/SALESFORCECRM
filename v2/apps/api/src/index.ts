import 'dotenv/config';
import { Server } from 'socket.io';
import { getApp } from './app.js';
import { startScheduledCallReminderWorker } from './services/scheduled-call-reminders.js';

const port = Number(process.env.PORT || process.env.API_PORT || 4000);

const app = await getApp();

startScheduledCallReminderWorker();

await app.listen({ port, host: '0.0.0.0' });

const io = new Server(app.server, { cors: { origin: true } });
io.on('connection', (socket) => {
  socket.on('join', (userId: number) => socket.join(`user:${userId}`));
});

console.log(`API http://localhost:${port} | WebSocket enabled`);
