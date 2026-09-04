import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
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
      },
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
