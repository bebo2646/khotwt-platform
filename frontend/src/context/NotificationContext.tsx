import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import API from '../services/api'
import { useAuthStore } from '../store/authStore'

interface Notification {
  id: number
  title: string
  message: string
  recipient_type: string
  recipient_id: number | null
  important: boolean
  send_to_admin: boolean
  is_read: boolean
  is_seen: boolean
  created_at: string
}

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  activeImportant: Notification | null
  loading: boolean
  fetchNotifications: () => Promise<void>
  markAsRead: (id: number) => Promise<void>
  markAsSeen: (id: number) => Promise<void>
  markAllAsRead: () => Promise<void>
  dismissImportant: (markRead: boolean) => Promise<void>
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoggedIn, user } = useAuthStore()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [activeImportant, setActiveImportant] = useState<Notification | null>(null)
  const [loading, setLoading] = useState(false)
  
  // Track IDs of important notifications that have already been shown as a toast/popup
  const [shownImportantIds, setShownImportantIds] = useState<number[]>([])

  useEffect(() => {
    if (isLoggedIn && user?.id) {
      try {
        const stored = localStorage.getItem(`shown_notifications_${user.id}`)
        setShownImportantIds(stored ? JSON.parse(stored) : [])
      } catch (err) {
        console.error('[NotificationContext] Failed to load shown notifications from localStorage:', err)
        setShownImportantIds([])
      }
    } else {
      setShownImportantIds([])
    }
  }, [isLoggedIn, user?.id])

  const markIdAsShown = (id: number) => {
    if (!user?.id) return
    setShownImportantIds(prev => {
      if (prev.includes(id)) return prev
      const next = [...prev, id]
      try {
        localStorage.setItem(`shown_notifications_${user.id}`, JSON.stringify(next))
      } catch (err) {
        console.error('[NotificationContext] Failed to save shown notification to localStorage:', err)
      }
      return next
    })
  }

  const fetchNotifications = async () => {
    if (!isLoggedIn || user?.must_change_password) return
    
    try {
      // 1 & 2. Get unread count and recent notifications in parallel
      const [countRes, notifRes] = await Promise.all([
        API.get('/notifications/unread-count'),
        API.get('/notifications')
      ])
      setUnreadCount(countRes.data.unread_count || 0)
      const fetchedNotifs = notifRes.data || []
      
      // Filter out duplicate IDs
      const uniqueFetched = fetchedNotifs.filter(
        (value: Notification, index: number, self: Notification[]) => 
          self.findIndex(t => t.id === value.id) === index
      )
      if (import.meta.env.DEV) {
        console.log('[Notifications Response]:', uniqueFetched)
      }
      setNotifications(uniqueFetched.slice(0, 8))

      // 3. Find any unseen important notification that has not been shown/dismissed yet
      const importantUnseen = uniqueFetched.find(
        (n: Notification) => n.important && !n.is_seen && !shownImportantIds.includes(n.id)
      )

      if (importantUnseen) {
        setActiveImportant(importantUnseen)
        markIdAsShown(importantUnseen.id)
        
        // Auto-mark as seen on server to prevent popups on other devices/page refreshes
        API.post(`/notifications/${importantUnseen.id}/seen`).catch(err => {
          console.error('[NotificationContext] Failed to auto-seen notification:', err)
        })
      }
    } catch (err) {
      console.error('[NotificationContext] Failed to fetch notifications:', err)
    }
  }

  const markAsRead = async (id: number) => {
    try {
      await API.post(`/notifications/${id}/read`)
      setUnreadCount(prev => Math.max(0, prev - 1))
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    } catch (err) {
      console.error('[NotificationContext] Failed to mark as read:', err)
    }
  }

  const markAsSeen = async (id: number) => {
    try {
      await API.post(`/notifications/${id}/seen`)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_seen: true } : n))
    } catch (err) {
      console.error('[NotificationContext] Failed to mark as seen:', err)
    }
  }

  const markAllAsRead = async () => {
    try {
      await API.post('/notifications/read-all')
      setUnreadCount(0)
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch (err) {
      console.error('[NotificationContext] Failed to mark all as read:', err)
    }
  }

  const dismissImportant = async (markRead: boolean) => {
    if (!activeImportant) return
    const id = activeImportant.id
    setActiveImportant(null)

    try {
      await API.post(`/notifications/${id}/seen`)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_seen: true } : n))

      if (markRead) {
        await API.post(`/notifications/${id}/read`)
        setUnreadCount(prev => Math.max(0, prev - 1))
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
      }
    } catch (err) {
      console.error('[NotificationContext] Failed to dismiss important notification:', err)
    }
  }

  useEffect(() => {
    if (isLoggedIn) {
      fetchNotifications()
      const interval = setInterval(fetchNotifications, 30000) // Poll every 30s
      return () => clearInterval(interval)
    } else {
      setNotifications([])
      setUnreadCount(0)
      setActiveImportant(null)
    }
  }, [isLoggedIn])

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      activeImportant,
      loading,
      fetchNotifications,
      markAsRead,
      markAsSeen,
      markAllAsRead,
      dismissImportant
    }}>
      {children}
    </NotificationContext.Provider>
  )
}

export const useNotifications = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}
