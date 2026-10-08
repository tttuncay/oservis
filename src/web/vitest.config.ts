import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const resolvePath = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirrors vite.config.ts; see the rationale there.
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': resolvePath('./src'),
      '@servisapp/shared': resolvePath('../../packages/shared/src/index.ts'),
      '@servisapp/i18n': resolvePath('../../packages/i18n/src/index.ts'),
      '@servisapp/contracts': resolvePath('../../packages/contracts/src/index.ts'),
    },
  },
  test: {
    name: 'unit-web',
    root: resolvePath('.'),
    environment: 'jsdom',
    globals: true,

    // `resolve.dedupe` above only governs what Vite itself resolves, and Vitest hands
    // `node_modules` imports to Node instead of transforming them. React Query would there-
    // fore still be loaded by Node's resolver, which finds the React 19 copy nested beside
    // it and reintroduces the very duplicate the dedupe exists to prevent. Inlining puts it
    // back through Vite, where the dedupe applies.
    server: {
      deps: {
        inline: ['@tanstack/react-query'],
      },
    },
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.spec.{ts,tsx}'],
  },
});
