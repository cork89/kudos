import { defineConfig } from 'vite-plus';
import { builtinModules } from 'node:module';

export default defineConfig({
  ssr: {
    noExternal: true,
  },
  build: {
    emptyOutDir: true,
    ssr: 'index.ts',
    outDir: '../../dist/server',
    target: 'node22',
    sourcemap: false,
    minify: true,
    rollupOptions: {
      external: [...builtinModules],
      output: {
        format: 'cjs',
        entryFileNames: 'index.cjs',
        inlineDynamicImports: true,
        // format: 'es',
        // entryFileNames: 'index.js',
        // inlineDynamicImports: true,
      },
    },
  },
});
