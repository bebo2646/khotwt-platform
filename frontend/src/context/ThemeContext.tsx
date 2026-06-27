import React, { createContext, useContext, useState, useEffect } from 'react'

export interface ColorTokens {
  background: string
  card: string
  primary: string
  secondary: string
  text: string
  textSecondary: string
  border: string
  success: string
  danger: string
  warning: string
}

export const themeColors: Record<'dark' | 'light', ColorTokens> = {
  dark: {
    background: '#0B1120',
    card: '#111827',
    primary: '#6366F1',
    secondary: '#8B5CF6',
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    border: 'rgba(255, 255, 255, 0.08)',
    success: '#10B981',
    danger: '#EF4444',
    warning: '#F59E0B'
  },
  light: {
    background: '#F8FAFC',
    card: '#FFFFFF',
    primary: '#6366F1',
    secondary: '#8B5CF6',
    text: '#0F172A',
    textSecondary: '#475569',
    border: '#E2E8F0',
    success: '#10B981',
    danger: '#EF4444',
    warning: '#F59E0B'
  }
}

interface ThemeContextType {
  theme: 'dark' | 'light'
  colors: ColorTokens
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const savedTheme = localStorage.getItem('elm_theme') as 'dark' | 'light' | null
    const root = document.documentElement
    
    if (savedTheme === 'light') {
      setTheme('light')
      root.classList.add('light-theme')
    } else {
      setTheme('dark')
      root.classList.remove('light-theme')
    }
  }, [])

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    const root = document.documentElement
    
    if (nextTheme === 'light') {
      root.classList.add('light-theme')
    } else {
      root.classList.remove('light-theme')
    }
    
    localStorage.setItem('elm_theme', nextTheme)
    setTheme(nextTheme)
  }

  const colors = themeColors[theme]

  return (
    <ThemeContext.Provider value={{ theme, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
