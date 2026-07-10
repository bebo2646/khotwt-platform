import axios from 'axios'
import { useModalStore } from '../store/modalStore'
import { useAuthStore } from '../store/authStore'

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

// Global response interceptor for handling retries, validation/server errors, 401/409/403/503 sessions
API.interceptors.response.use(
  (response) => {
    const resData = response.data
    if (resData && typeof resData === 'object' && 'success' in resData && 'data' in resData) {
      response.data = resData.data
    }
    return response
  },
  async (error) => {
    const config = error.config

    // 1. Automatic retry for Neno/Render free hosting cold start (sleeping hosting)
    // Retry up to 3 times, with 2 seconds interval if it's a network error, timeout, or 500-504 server error
    const isRetryable = config && (!error.response || (error.response.status >= 500 && error.response.status <= 504))
    if (isRetryable) {
      config.__retryCount = config.__retryCount || 0
      if (config.__retryCount < 3) {
        config.__retryCount += 1
        console.warn(`[API Retry] Request to ${config.url} failed. Retrying (${config.__retryCount}/3) in 2 seconds due to potential hosting sleep...`)
        await new Promise((resolve) => setTimeout(resolve, 2000))
        return API(config)
      }
    }

    // 2. Assign actual Laravel validation or backend exception messages to error.message
    if (error.response) {
      const { status, data } = error.response

      if (data && typeof data === 'object') {
        let msg = data.message
        if (data.errors && typeof data.errors === 'object') {
          // Flatten and join Laravel validation messages
          const valMsgs = Object.values(data.errors).flat().join('\n')
          if (valMsgs) {
            msg = valMsgs
          }
        }
        if (msg) {
          error.message = msg // Overwrite the generic error.message
        }
      }
      
      if (status === 401) {
        // Clear auth on unauthenticated
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
        
        if (data && (data.code === 'SESSION_EXPIRED' || status === 401)) {
          useModalStore.getState().showToast('تم تسجيل الدخول من جهاز آخر.', 'error')
          window.dispatchEvent(new CustomEvent('elm_session_invalid'))
        }
      }

      if (status === 409 && data.session_invalid) {
        // Clear auth on session invalid (logged in from another device)
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
        window.dispatchEvent(new CustomEvent('elm_session_invalid'))
      }

      if (status === 403 && data.must_change_password) {
        // Handle forcing password change redirection
        if (window.location.pathname !== '/change-password') {
          window.dispatchEvent(new CustomEvent('elm_must_change_password'))
        }
      }

      if (status === 503 && data && data.maintenance) {
        // Store maintenance details in sessionStorage for the /maintenance page
        sessionStorage.setItem('maintenance_message', data.message || '')
        sessionStorage.setItem('maintenance_eta', data.eta || '')
        
        // Log out the user
        const authStore = useAuthStore.getState()
        authStore.logout()

        // Redirect to maintenance screen
        if (window.location.pathname !== '/maintenance') {
          window.location.href = '/maintenance'
        }
      }
    }
    return Promise.reject(error)
  }
)

export default API
