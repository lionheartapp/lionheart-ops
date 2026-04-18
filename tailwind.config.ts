import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      spacing: {
        'safe-t': 'var(--safe-area-top)',
        'safe-b': 'var(--safe-area-bottom)',
        'safe-l': 'var(--safe-area-left)',
        'safe-r': 'var(--safe-area-right)',
      },
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
      // Audit ref L5: app-wide gradients were hard-coded inline at 40+ call
      // sites (login shell, dashboard skeleton, loading screens, hero cards).
      // These tokens let `bg-app-mist`, `bg-app-aurora`, and
      // `bg-gradient-brand` stay consistent and make re-theming a single-file
      // change instead of a grep-and-replace.
      backgroundImage: {
        'app-mist':
          'linear-gradient(135deg, #e8eaf0, #d4dbe8, #c8d4e4, #d8dce8, #e4e6ec)',
        'app-aurora':
          'linear-gradient(135deg, #eff6ff 0%, #dbeafe 40%, #e0e7ff 100%)',
        'app-sunrise':
          'linear-gradient(135deg, #fff7ed, #ffedd5, #fde68a)',
        'gradient-brand':
          'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)',
        'gradient-brand-soft':
          'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
        'gradient-success':
          'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
        'gradient-warning':
          'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
        'gradient-danger':
          'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
      animation: {
        blink: 'blink 1s step-end infinite',
      },
      zIndex: {
        dropdown: '10',
        sticky: '20',
        navbar: '30',
        sidebar: '35',
        mobilenav: '40',
        modal: '50',
        lightbox: '60',
        command: '65',
        toast: '70',
        popover: '75',
      },
    },
  },
  plugins: [],
} satisfies Config
