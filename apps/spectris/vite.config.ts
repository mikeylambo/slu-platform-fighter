import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Two entries: the game, and the helm line-up proof page (all Oath helms on the shared rig).
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        lineup: resolve(import.meta.dirname, 'lineup.html'),
      },
    },
  },
});
