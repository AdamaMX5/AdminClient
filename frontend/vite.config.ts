import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { execSync } from 'child_process';
import path from 'path';

// Short git hash baked in at build time so admins can verify the deployed version.
function gitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
}

export default defineConfig({
  define: {
    __GIT_HASH__: JSON.stringify(gitHash()),
  },
  plugins: [react(), viteSingleFile()],
  root: __dirname,
  // Read .env files from the repo root instead of frontend/, so there's a single
  // .env per deployment shared with the backend. Vite only ever inlines
  // VITE_-prefixed keys into the client bundle — everything else in that file
  // (e.g. plain AUTH_SERVICE_URL, used server-side for /health) stays server-only.
  envDir: path.resolve(__dirname, '..'),
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
    },
  },
});
