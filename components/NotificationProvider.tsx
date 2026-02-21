'use client'

import { useNotifications } from '@/lib/useNotifications'
import NotificationBell from './NotificationBell'
import ToastContainer from './ToastContainer'

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
      {/* Fixed bell in top-right */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
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
