/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /* Lionheart primary accent */
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
        blue: {
          950: '#172554',
        },
        navy: {
          900: '#0f172a',
          850: '#13203a',
          800: '#1e293b',
          750: '#243447',
          700: '#334155',
        },
      },
      backgroundImage: {
        'gradient-blue-card': 'linear-gradient(135deg, rgba(30, 58, 138, 0.4) 0%, rgba(59, 130, 246, 0.15) 50%, rgba(30, 64, 175, 0.3) 100%)',
        'gradient-blue-subtle': 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.95) 100%)',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(-4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
