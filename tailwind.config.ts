import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ['var(--font-heading)', 'Oswald', 'sans-serif'],
        body: ['var(--font-body)', 'Poppins', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
      },
      boxShadow: {
        subtle: 'var(--shadow-subtle)',
        medium: 'var(--shadow-medium)',
        heavy: 'var(--shadow-heavy)',
      },
      zIndex: {
        dropdown: '10',
        sticky: '20',
        navbar: '30',
        sidebar: '35',
        mobilenav: '40',
        modal: '50',
        lightbox: '60',
        toast: '70',
      },
    },
  },
  plugins: [],
} satisfies Config
