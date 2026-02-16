// Sentry initialization must be first
import './instrument'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from './context/ThemeContext'
import AppRouter from './AppRouter.jsx'
import GlobalErrorBoundary from './components/GlobalErrorBoundary'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <GlobalErrorBoundary>
        <AppRouter />
      </GlobalErrorBoundary>
    </ThemeProvider>
  </React.StrictMode>,
)
