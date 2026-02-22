import { createContext, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'lionheart-theme'

const ThemeContext = createContext({ theme: 'light', setTheme: () => {} })

export function ThemeProvider({ children }) {
  // Always start in light mode (do not read from localStorage, so no stuck dark mode).
  const [theme, setThemeState] = useState('light')

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, theme)
    }
  }, [theme])

  const setTheme = (value) => setThemeState(value === 'dark' ? 'dark' : 'light')

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
