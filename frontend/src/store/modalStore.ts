import { create } from 'zustand'

export interface ToastItem {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
}

export interface ConfirmOptions {
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  type?: 'warning' | 'delete' | 'success' | 'question'
  onConfirm: () => void
  onCancel?: () => void
}

export interface AlertOptions {
  title: string
  description: string
  buttonText?: string
  type?: 'warning' | 'success' | 'info' | 'error'
  onConfirm?: () => void
}

interface ModalState {
  // Toasts
  toasts: ToastItem[]
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  removeToast: (id: string) => void

  // Confirm Modal
  confirmOpen: boolean
  confirmOptions: ConfirmOptions | null
  showConfirm: (options: ConfirmOptions) => void
  closeConfirm: () => void

  // Alert Modal
  alertOpen: boolean
  alertOptions: AlertOptions | null
  showAlert: (options: AlertOptions) => void
  closeAlert: () => void
}

export const useModalStore = create<ModalState>((set, get) => ({
  toasts: [],
  showToast: (message, type = 'success') => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast = { id, message, type }
    set((state) => ({ toasts: [...state.toasts, newToast] }))
    
    // Auto remove toast after 4 seconds
    setTimeout(() => {
      get().removeToast(id)
    }, 4000)
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  },

  confirmOpen: false,
  confirmOptions: null,
  showConfirm: (options) => set({ confirmOpen: true, confirmOptions: options }),
  closeConfirm: () => set({ confirmOpen: false, confirmOptions: null }),

  alertOpen: false,
  alertOptions: null,
  showAlert: (options) => set({ alertOpen: true, alertOptions: options }),
  closeAlert: () => set({ alertOpen: false, alertOptions: null }),
}))
