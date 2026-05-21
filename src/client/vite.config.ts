import { defineConfig } from 'vite-plus';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { tanstackRouter } from '@tanstack/router-vite-plugin';

const clientDir = dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig(() => {
  const isMock = process.env.USE_MOCKS === 'true';
  console.log('[CLIENT] isMock === ', isMock);
  return {
    publicDir: resolve(clientDir, '../../public'),
    plugins: [
      react({}),
      tanstackRouter({
        routesDirectory: './routes',
        generatedRouteTree: './routeTree.gen.ts',
      }),
    ],
    build: {
      outDir: '../../dist/client',
      emptyOutDir: true,
      sourcemap: false,
      minify: true,
      rolldownOptions: {
        input: {
          default: resolve(clientDir, './index.html'),
        },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: '[name].js',
          assetFileNames: '[name][extname]',
          // sourcemapFileNames: '[name].js.map',
        },
      },
    },
    resolve: {
      alias: {
        '@/devvit/web/client': resolve(
          clientDir,
          isMock ? 'devvit/devvit.mock.ts' : 'devvit/devvit.client.ts'
        ),
      },
    },
  };
});
