import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const db = path.join(dir, '../prisma/dev.db');
const dbNested = path.join(dir, '../prisma/prisma/dev.db');
const journal = path.join(dir, '../prisma/dev.db-journal');
const journalNested = path.join(dir, '../prisma/prisma/dev.db-journal');
for (const f of [db, dbNested, journal, journalNested]) {
  if (fs.existsSync(f)) {
    fs.unlinkSync(f);
    console.log('Removed', f);
  }
}
