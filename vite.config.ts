import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import pkg from './package.json' with { type: 'json' }

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    host: true,
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
