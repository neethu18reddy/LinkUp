import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    clearMocks: true,
    maxWorkers: 4,
    testTimeout: 10000,
    env: {
      NODE_ENV: 'test',
      LLM_PROVIDER: 'disabled',
      LLM_LIVE_CALLS_APPROVED: 'false',
      LOCAL_JOBS_ENABLED: 'false',
      EMAIL_PROVIDER: 'disabled',
      EMAIL_LIVE_CALLS_APPROVED: 'false',
      GOOGLE_OAUTH_ENABLED: 'false',
    },
  },
});
