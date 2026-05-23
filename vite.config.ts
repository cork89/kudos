import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { tanstackRouter } from '@tanstack/router-vite-plugin';
import { defineConfig, loadEnv, type Plugin } from 'vite-plus';

const rootDir = dirname(fileURLToPath(import.meta.url));
const clientRoot = resolve(rootDir, 'src/client');
const localServerEntry = resolve(rootDir, 'src/server/index.ts');
const productionServerEntry = resolve(rootDir, 'src/server/index.ts');
const devvitServerMock = resolve(rootDir, 'src/server/devvit/devvit.mock.ts');
const devvitClientMock = resolve(rootDir, 'src/client/devvit/devvit.mock.ts');
const devvitClient = resolve(rootDir, 'src/client/devvit/devvit.client.ts');

function localApiPlugin(): Plugin {
  type LocalAppModule = {
    default: { fetch(request: Request): Promise<Response> };
  };

  async function handleApiRequest(
    req: IncomingMessage,
    res: ServerResponse,
    loadApp: () => Promise<Record<string, unknown>>
  ): Promise<void> {
    const mod = (await loadApp()) as LocalAppModule;
    const response = await mod.default.fetch(await createWebRequest(req));
    await writeWebResponse(res, response);
  }

  return {
    name: 'local-api-middleware',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/client/')) {
          req.url = req.url.replace(/^\/client/, '') || '/';
        }

        const pathname = req.url
          ? new URL(req.url, getOrigin(req)).pathname
          : '/';
        if (!pathname.startsWith('/api') && !pathname.startsWith('/internal')) {
          next();
          return;
        }

        void handleApiRequest(req, res, () =>
          server.ssrLoadModule(localServerEntry)
        ).catch(next);
      });
    },
  };
}

async function createWebRequest(req: IncomingMessage): Promise<Request> {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(name, item);
      }
      continue;
    }

    headers.set(name, value);
  }

  const body =
    req.method === 'GET' || req.method === 'HEAD'
      ? undefined
      : await readRequestBody(req);

  return new Request(new URL(req.url ?? '/', getOrigin(req)), {
    method: req.method ?? 'GET',
    headers,
    body,
  });
}

async function readRequestBody(req: IncomingMessage): Promise<ArrayBuffer> {
  const chunks: Uint8Array[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  const buffer = Buffer.concat(chunks);
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  );
}

function getOrigin(req: IncomingMessage): string {
  return `http://${req.headers.host ?? 'localhost:7474'}`;
}

async function writeWebResponse(
  res: ServerResponse,
  response: Response
): Promise<void> {
  res.statusCode = response.status;
  res.statusMessage = response.statusText;

  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  const body = Buffer.from(await response.arrayBuffer());
  res.end(body);
}

// Static export required: Oxc reads `lint` / `fmt` from vite.config.ts without
// executing Vite's config loader, so functional configs are not supported.
// https://viteplus.dev/guide/troubleshooting#vp-lint-vp-fmt-may-fail-to-read-vite-config-ts
const env = loadEnv(
  process.env.MODE ?? process.env.NODE_ENV ?? 'development',
  rootDir,
  ''
);
const useMocks = env.USE_MOCKS === 'true';

export default defineConfig({
  root: clientRoot,
  publicDir: resolve(rootDir, 'assets'),
  resolve: {
    alias: {
      '@/devvit/web/client': useMocks ? devvitClientMock : devvitClient,
      ...(useMocks ? { '@devvit/web/server': devvitServerMock } : {}),
    },
  },
  plugins: [
    react(),
    tanstackRouter({
      routesDirectory: resolve(clientRoot, 'routes'),
      generatedRouteTree: resolve(clientRoot, 'routeTree.gen.ts'),
    }),
    localApiPlugin(),
  ],
  server: {
    port: 7474,
  },
  preview: {
    port: 7474,
  },
  build: {
    outDir: resolve(rootDir, 'dist/client'),
    emptyOutDir: true,
    sourcemap: true,
    minify: true,
    rolldownOptions: {
      input: {
        default: resolve(clientRoot, 'index.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name][extname]',
      },
    },
  },
  pack: {
    entry: [productionServerEntry],
    outDir: resolve(rootDir, 'dist/server'),
    platform: 'node',
    target: 'node24',
    format: 'esm',
    clean: true,
    sourcemap: true,
    minify: {
      compress: {
        dropConsole: false,
      },
    },
    outExtensions: () => ({ js: '.js' }),
    deps: {
      alwaysBundle: [/.*/],
    },
  },
  lint: {
    ignorePatterns: ['src/client/routeTree.gen.ts'],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {
    singleQuote: true,
    trailingComma: 'es5',
    quoteProps: 'preserve',
    semi: true,
    printWidth: 80,
    sortPackageJson: false,
    ignorePatterns: ['src/client/routeTree.gen.ts'],
  },
  test: {
    root: rootDir,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    maxWorkers: 1,
  },
});
