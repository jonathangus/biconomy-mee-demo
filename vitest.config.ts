/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // globalSetup: './src/tests/setup.ts',
    testTimeout: 60000, // 60 seconds for mainnet fork tests
    hookTimeout: 30000, // 30 seconds for setup/teardown
    environment: 'node',
    globals: true,
    // Run tests sequentially to avoid conflicts with the fork
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
