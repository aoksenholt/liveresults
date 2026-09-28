import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Cloudflare Pages gives the commit; other builds get a new id each time.
const build = process.env.CF_PAGES_COMMIT_SHA ?? Date.now().toString(36);

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'version-file',
      apply: 'build',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({ build }),
        });
      },
    },
  ],
  define: { 'import.meta.env.VITE_BUILD_ID': JSON.stringify(build) },
  base: './',
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
