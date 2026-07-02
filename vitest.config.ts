import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    maxWorkers: 1,
    pool: 'threads',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'outputs/**',
      'work/**',
      'tests/firestore-rules/**',
    ],
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
});
