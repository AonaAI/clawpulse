'use client'

import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'onboarding_complete'

export function useOnboarding() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== 'true') {
        setShow(true)
      }
    } catch {}
  }, [])

  const restart = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
    setShow(true)
  }, [])

  const dismiss = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, 'true') } catch {}
    setShow(false)
  }, [])

  return { show, restart, dismiss }
}
