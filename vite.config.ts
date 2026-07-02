import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repositoryName =
  process.env.GITHUB_REPOSITORY?.split('/').at(-1) ?? 'toyota-payroll';
const base = process.env.GITHUB_ACTIONS ? `/${repositoryName}/` : '/';

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    sourcemap: true,
  },
});
