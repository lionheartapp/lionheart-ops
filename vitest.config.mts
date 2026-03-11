import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    react(),
  ],
  test: {
    environment: 'node',
    globals: true,
    setupFiles: [],
    include: ['__tests__/**/*.test.ts'],
    env: {
      AUTH_SECRET: 'ci-test-secret-32-chars-minimum-x',
      DATABASE_URL: '',
      DIRECT_URL: '',
    },
  },
})
