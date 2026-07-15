import { rmSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';

const raw = process.env.GOYLLM_DATA_DIR || './data';
const dir = isAbsolute(raw) ? raw : join(process.cwd(), raw);

for (const suffix of ['goyllm.db', 'goyllm.db-wal', 'goyllm.db-shm']) {
  try {
    rmSync(join(dir, suffix));
    console.log(`removed ${suffix}`);
  } catch {
    /* not present */
  }
}
console.log('database reset — it will be recreated on next start');
