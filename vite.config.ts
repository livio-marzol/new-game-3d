import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 3000,
    open: false,
    host: true,
    watch: {
      ignored: [
        '**/*.glb',
        '**/dist/**',
        '**/.git/**',
        '**/.chrome_data/**',
        '**/.cache/**',
        '**/node_modules/**'
      ]
    }
  }
});
