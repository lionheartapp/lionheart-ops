import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      usePolling: true,
      interval: 1000,
    },
    proxy: {
      '/api/ical': {
        target: 'https://extbus.schooldude.com',
        changeOrigin: true,
        rewrite: () => '/ical/fsdevent.ics?qs=lGqBfbQokjU%2FitNZTrekyTvxV5Tpn1mZp43BXgGUqYYYmuSypNh3BnRH%2BatHZf9y',
        secure: true,
      },
    },
  },
})
