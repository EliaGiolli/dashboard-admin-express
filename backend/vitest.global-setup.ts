import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { testDatabaseFile, testDatabaseUrl } from './vitest.env.js';

export default function setup() {
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    rmSync(`${testDatabaseFile}${suffix}`, { force: true });
  }
  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
  });
}
