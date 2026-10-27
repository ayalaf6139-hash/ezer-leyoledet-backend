// יוצר את הקובץ docs/openapi.json מתוך התיעוד שבקוד (npm run openapi)
import fs from 'node:fs';
import path from 'node:path';
import { openApiDocument } from '../src/docs/openapi';

const target = path.join(__dirname, '..', 'docs', 'openapi.json');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(openApiDocument, null, 2) + '\n', 'utf8');
console.log(`✅ נכתב ${target}`);
