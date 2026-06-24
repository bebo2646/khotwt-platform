import axios from 'axios'
import { useModalStore } from '../store/modalStore'

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
})

// Attach Bearer token and X-Session-Token from localStorage if present
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token') || localStorage.getItem('elm_token')
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  const sessionToken = localStorage.getItem('session_token') || localStorage.getItem('elm_session_token')
  if (sessionToken && config.headers) {
    config.headers['X-Session-Token'] = sessionToken
  }
  return config
}, (error) => {
  return Promise.reject(error)
})

// Global response interceptor for handling 401 (unauthorized), 409 (session invalid) and force-password flags
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response
      
      if (status === 401) {
        // Clear auth on unauthenticated
        localStorage.removeItem('auth_token')
        localStorage.removeItem('elm_token')
        localStorage.removeItem('session_token')
        localStorage.removeItem('elm_session_token')
        localStorage.removeItem('elm_user')
        
        if (data && (data.code === 'SESSION_EXPIRED' || status === 401)) {
          useModalStore.getState().showToast('تم تسجيل الدخول من جهاز آخر.', 'error')
          window.dispatchEvent(new CustomEvent('elm_session_invalid'))
        }
      }

      if (status === 409 && data.session_invalid) {
        // Clear auth on session invalid (logged in from another device)
        localStorage.removeItem('auth_token')
        localStorage.removeItem('elm_token')
        localStorage.removeItem('session_token')
        localStorage.removeItem('elm_session_token')
        localStorage.removeItem('elm_user')
        window.dispatchEvent(new CustomEvent('elm_session_invalid'))
      }

      if (status === 403 && data.must_change_password) {
        // Handle forcing password change redirection
        if (window.location.pathname !== '/change-password') {
          window.dispatchEvent(new CustomEvent('elm_must_change_password'))
        }
      }
    }
    return Promise.reject(error)
  }
)

export default API
