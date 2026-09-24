import { defineConfig } from 'vitest/config';
import { testDatabaseUrl } from './vitest.env.js';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globalSetup: ['./vitest.global-setup.ts'],
    fileParallelism: false,
    testTimeout: 15000,
    env: { DATABASE_URL: testDatabaseUrl, NODE_ENV: 'test' },
  },
});
