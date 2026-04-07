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
    environmentMatchGlobs: [
      ['__tests__/components/**/*.test.tsx', 'jsdom'],
    ],
    include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx'],
    env: {
      AUTH_SECRET: 'ci-test-secret-32-chars-minimum-x',
      DATABASE_URL: '',
      DIRECT_URL: '',
    },
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'text-summary', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/types.ts',
        'src/app/**/layout.tsx',
        'src/app/**/loading.tsx',
        'src/app/**/error.tsx',
      ],
      thresholds: {
        statements: 5,
        branches: 5,
        functions: 5,
        lines: 5,
      },
    },
  },
})
