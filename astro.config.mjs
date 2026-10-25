// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': '/src',
        '@components': '/src/components',
        '@public': '/public',
        '@assets': '/src/assets',
        '@layouts': '/src/layouts',
        '@data': '/src/data',
      }
    }
  },
  server: {
    host: true,
    port: 4321,
  }
});
