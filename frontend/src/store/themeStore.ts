import { create } from 'zustand'

interface ThemeState {
  theme: 'dark' | 'light'
  toggleTheme: () => void
  initTheme: () => void
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'dark', // Dark is default
  toggleTheme: () => {
    const nextTheme = get().theme === 'dark' ? 'light' : 'dark'
    
    const root = document.documentElement
    if (nextTheme === 'light') {
      root.classList.add('light-theme')
    } else {
      root.classList.remove('light-theme')
    }
    
    localStorage.setItem('elm_theme', nextTheme)
    set({ theme: nextTheme })
  },
  initTheme: () => {
    const savedTheme = localStorage.getItem('elm_theme') as 'dark' | 'light' | null
    const root = document.documentElement
    
    if (savedTheme === 'light') {
      root.classList.add('light-theme')
      set({ theme: 'light' })
    } else {
      root.classList.remove('light-theme')
      set({ theme: 'dark' })
    }
  }
}))
