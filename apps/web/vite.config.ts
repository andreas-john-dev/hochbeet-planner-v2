import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { type Connect, defineConfig, type Plugin } from 'vite';

/**
 * Serves config.dev.json as /config.json on the dev server and in `vite preview` (used for
 * Lighthouse runs against the production build). In prod, CDK writes config.json at deploy
 * time; the file never ends up in the build.
 */
function devConfig(): Plugin {
  const serveConfig = (server: { middlewares: Connect.Server }) => {
    server.middlewares.use('/config.json', (_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-cache');
      res.end(readFileSync(new URL('./config.dev.json', import.meta.url)));
    });
  };
  return {
    name: 'hochbeet-dev-config',
    configureServer: serveConfig,
    configurePreviewServer: serveConfig,
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devConfig()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173, strictPort: true },
  // main.tsx awaits config.json before rendering.
  build: { target: 'es2022' },
});
