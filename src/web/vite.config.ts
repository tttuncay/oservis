import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const resolvePath = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    // One React, resolved from this app.
    //
    // The root `.npmrc` sets `node-linker=hoisted` because Metro cannot read pnpm's
    // symlinked layout, so the workspace shares a single physical `node_modules`. A package
    // both apps depend on — `@tanstack/react-query` — therefore exists once, and pnpm
    // satisfies its `react` peer from the mobile side: since Expo SDK 54 that is React 19,
    // nested at `node_modules/@tanstack/react-query/node_modules/react`.
    //
    // Left alone, this console loads React 19's hook dispatcher through React Query and
    // React 18's renderer through `react-dom`, and every component using a query throws
    // "Invalid hook call". Deduplicating resolves both names from `apps/web` instead, which
    // is React 18 — the version SDD §2.3 pins the web frontend to.
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': resolvePath('./src'),

      // The workspace packages are compiled from source rather than from their CommonJS
      // `dist`. They are first-party TypeScript, and Rollup cannot statically resolve
      // named exports out of a linked CommonJS package — a re-export of `t` fails the
      // build. The API, which runs on Node, still consumes the built `dist`.
      '@servisapp/shared': resolvePath('../../packages/shared/src/index.ts'),
      '@servisapp/i18n': resolvePath('../../packages/i18n/src/index.ts'),
      '@servisapp/contracts': resolvePath('../../packages/contracts/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    // The console is served from a CDN as a static bundle (SDD §2.2).
    outDir: 'dist',
    sourcemap: true,
  },
});
