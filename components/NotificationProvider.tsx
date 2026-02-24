'use client'

import { useNotifications } from '@/lib/useNotifications'
import NotificationBell from './NotificationBell'
import ToastContainer from './ToastContainer'
import ThemeToggle from './ThemeToggle'

export default function NotificationProvider() {
  const {
    notifications,
    unreadCount,
    toasts,
    soundEnabled,
    markAsRead,
    markAllRead,
    toggleSound,
    dismissToast,
  } = useNotifications()

  return (
    <>
      {/* Fixed bell in top-right - responsive positioning to avoid mobile header overlap */}
      <div className="fixed top-20 md:top-4 right-4 z-50 flex items-center gap-1">
        <ThemeToggle />
        <NotificationBell
          notifications={notifications}
          unreadCount={unreadCount}
          soundEnabled={soundEnabled}
          onMarkRead={markAsRead}
          onMarkAllRead={markAllRead}
          onToggleSound={toggleSound}
        />
      </div>

      {/* Toast container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  )
}
