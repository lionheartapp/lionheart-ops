import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { OrgModulesProvider } from './context/OrgModulesContext'
import { ThemeProvider } from './context/ThemeContext'
import { SubdomainResolver } from './components/SubdomainResolver'
import GlobalErrorBoundary from './components/GlobalErrorBoundary'
import LandingPage from './pages/LandingPage'
import SignupPage from './pages/SignupPage'
import LoginPage from './pages/LoginPage'
import AuthCallbackPage from './pages/AuthCallbackPage'
import DashboardApp from './App.jsx'

const DashboardWrapper = () => (
  <SubdomainResolver>
    <ThemeProvider>
      <GlobalErrorBoundary>
        <OrgModulesProvider>
          <DashboardApp />
        </OrgModulesProvider>
      </GlobalErrorBoundary>
    </ThemeProvider>
  </SubdomainResolver>
)

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/app" element={<DashboardWrapper />} />
        <Route path="/app/*" element={<DashboardWrapper />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
