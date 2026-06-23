import { defineConfig, type Plugin } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

const backendHost = process.env.BACKEND_HOST ?? 'localhost';
const backendPort = process.env.BACKEND_PORT ?? '3001';

// Each page's HTML lives next to its source under src/pages/, but we keep clean,
// stable URLs. This maps the public URL → the co-located file (used by both the dev
// server below and the build inputs).
const PAGES: Record<string, string> = {
  '/index.html': 'src/pages/index.html',
  '/onboarding.html': 'src/pages/onboarding/onboarding.html',
  '/demo.html': 'src/pages/full-encounter-demo/demo.html',
  '/in-depth/transcribe.html': 'src/pages/in-depth/transcribe/transcribe.html',
  '/in-depth/dictate.html': 'src/pages/in-depth/dictate/dictate.html',
};

// Dev only: rewrite a clean page URL to its actual file so Vite serves/transforms it.
// "/" is treated as "/index.html". Everything else passes through untouched.
function cleanPageUrls(): Plugin {
  return {
    name: 'clean-page-urls',
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        const [path, query] = (request.url ?? '').split('?');
        const target = PAGES[path === '/' ? '/index.html' : path];
        if (target) {
          request.url = query ? `/${target}?${query}` : `/${target}`;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), cleanPageUrls()],
  server: {
    open: true,
    proxy: {
      '/api': `http://${backendHost}:${backendPort}`,
    },
  },
  build: {
    // The AudioWorklet must be a real served .js file — `addModule` doesn't reliably
    // accept the inlined `data:` URL Vite would otherwise produce for a small asset.
    assetsInlineLimit: (filePath) => (filePath.endsWith('rawPcm16Processor.js') ? false : undefined),
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/pages/index.html'),
        onboarding: resolve(__dirname, 'src/pages/onboarding/onboarding.html'),
        demo: resolve(__dirname, 'src/pages/full-encounter-demo/demo.html'),
        transcribe: resolve(__dirname, 'src/pages/in-depth/transcribe/transcribe.html'),
        dictate: resolve(__dirname, 'src/pages/in-depth/dictate/dictate.html'),
      },
    },
  },
});
