import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
let s = fs.readFileSync(schemaPath, 'utf8');
s = s.replace('provider = "mysql"', 'provider = "sqlite"');
s = s.replace(/\s*@db\.\w+(\([^)]*\))?/g, '');
s = s.replace(/BigInt\s+@id/g, 'Int      @id');
fs.writeFileSync(schemaPath, s);
console.log('Schema converted to SQLite');
