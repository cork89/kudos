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
    target: 'node24',
    sourcemap: false,
    minify: true,
    rollupOptions: {
      external: [...builtinModules],
      output: {
        format: 'esm',
        entryFileNames: 'index.mjs',
        inlineDynamicImports: true,
        // format: 'es',
        // entryFileNames: 'index.js',
        // inlineDynamicImports: true,
      },
    },
  },
});
