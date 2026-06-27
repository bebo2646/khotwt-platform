import { create } from 'zustand'

export interface UserProfile {
  id: number
  name: string
  email: string
  role: 'admin' | 'teacher' | 'student'
  phone?: string
  parent_phone?: string
  bio?: string
  experience?: string
  avatar?: string
  subject?: string
  grades?: string[]
  status: 'active' | 'disabled'
  must_change_password: boolean
  is_super?: boolean
  is_super_admin?: boolean
  permissions?: string[]
  wallet?: {
    id: number
    balance: string
  }
}

interface AuthState {
  user: UserProfile | null
  token: string | null
  isLoggedIn: boolean
  isLoading: boolean
  login: (user: UserProfile, token: string, sessionToken?: string) => void
  logout: () => void
  updateUser: (user: Partial<UserProfile>) => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => {
  // Try loading initial credentials from localStorage
  const savedToken = localStorage.getItem('auth_token') || localStorage.getItem('elm_token')
  const savedUser = localStorage.getItem('elm_user')
  
  let user: UserProfile | null = null
  if (savedUser) {
    try {
      user = JSON.parse(savedUser)
    } catch (e) {
      localStorage.removeItem('elm_user')
    }
  }

  return {
    user,
    token: savedToken,
    isLoggedIn: !!savedToken && !!user,
    isLoading: false,
    login: (user, token, sessionToken) => {
      localStorage.setItem('auth_token', token)
      localStorage.setItem('elm_token', token)
      localStorage.setItem('elm_user', JSON.stringify(user))
      if (sessionToken) {
        localStorage.setItem('session_token', sessionToken)
        localStorage.setItem('elm_session_token', sessionToken)
      }
      set({ user, token, isLoggedIn: true })
    },
    logout: () => {
      const savedTheme = localStorage.getItem('theme')
      const rememberedEmail = localStorage.getItem('elm_remembered_email')
      localStorage.clear()
      sessionStorage.clear()
      if (savedTheme) {
        localStorage.setItem('theme', savedTheme)
      }
      if (rememberedEmail) {
        localStorage.setItem('elm_remembered_email', rememberedEmail)
      }
      set({ user: null, token: null, isLoggedIn: false })
    },
    updateUser: (updatedFields) => {
      set((state) => {
        if (!state.user) return state
        const newUser = { ...state.user, ...updatedFields }
        localStorage.setItem('elm_user', JSON.stringify(newUser))
        return { user: newUser }
      })
    },
    setLoading: (isLoading) => set({ isLoading }),
  }
})
