import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import pkg from './package.json' with { type: 'json' }

const compilacao = new Date()
const pad = (n: number) => String(n).padStart(2, '0')
// Versão informada ao servidor: a data da compilação (AAAAMMDD), no fuso de quem compila.
const versaoCompilacao = `${compilacao.getFullYear()}${pad(compilacao.getMonth() + 1)}${pad(compilacao.getDate())}`

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(compilacao.toISOString()),
    __BUILD_VERSION__: JSON.stringify(versaoCompilacao),
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
