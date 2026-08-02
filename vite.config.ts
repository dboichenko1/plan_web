/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  // GitHub Pages раздаёт проект с подпути /<репозиторий>/ — база задаётся сборке.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**'],
      thresholds: { branches: 100, functions: 100, lines: 100, statements: 100 },
    },
  },
})
