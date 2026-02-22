'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'cp-pwa-dismissed';

export default function PWAInstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if already installed or previously dismissed
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      localStorage.getItem(DISMISSED_KEY)
    ) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setVisible(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="banner"
      style={{
        position: 'fixed',
        bottom: '1.25rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        borderRadius: '0.875rem',
        background: 'rgba(17, 2, 29, 0.92)',
        border: '1px solid rgba(139,92,246,0.35)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(139,92,246,0.08)',
        maxWidth: 'calc(100vw - 2rem)',
        width: 'max-content',
      }}
    >
      {/* Icon */}
      <img
        src="/icons/icon-192.png"
        alt="ClawPulse"
        width={36}
        height={36}
        style={{ borderRadius: '0.5rem', flexShrink: 0 }}
      />

      {/* Text */}
      <div style={{ lineHeight: 1.3 }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#f8f4ff' }}>
          Install ClawPulse
        </div>
        <div style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: '0.125rem' }}>
          Add to home screen for quick access
        </div>
      </div>

      {/* Install button */}
      <button
        onClick={handleInstall}
        style={{
          padding: '0.375rem 0.875rem',
          borderRadius: '0.5rem',
          background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
          border: 'none',
          color: '#fff',
          fontSize: '0.75rem',
          fontWeight: 600,
          cursor: 'pointer',
          flexShrink: 0,
          letterSpacing: '0.01em',
        }}
      >
        Install
      </button>

      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        style={{
          background: 'none',
          border: 'none',
          color: '#6b7280',
          cursor: 'pointer',
          padding: '0.25rem',
          flexShrink: 0,
          fontSize: '1rem',
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        ✕
      </button>
    </div>
  );
}
