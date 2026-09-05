import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

function texliveDevPlugin() {
  return {
    name: 'texlive-dev-api',
    configureServer(server: any) {
      server.middlewares.use('/api/texlive', async (req: any, res: any) => {
        try {
          const { default: handler } = await import('./api/texlive.js');
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk);
          const rawBody = Buffer.concat(chunks).toString('utf-8');
          req.body = rawBody;
          await handler(req, res);
        } catch (e: any) {
          res.statusCode = 500;
          res.end(e.message || 'Internal error');
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), texliveDevPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      emptyOutDir: false,
    },
    server: {
      proxy: {
        '/mathtype-api': {
          target: 'https://latex2mathtypeweb.onrender.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/mathtype-api/, ''),
        },
        '/kroki-api': {
          target: 'https://kroki.io',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/kroki-api/, ''),
        },
        '/texlive-api': {
          target: 'https://texlive.net',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/texlive-api/, ''),
        },
      },
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
