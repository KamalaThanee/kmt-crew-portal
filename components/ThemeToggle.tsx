'use client'

import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

type ThemeMode = 'light' | 'dark'

function getPreferredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark'
  const stored = localStorage.getItem('kmt_theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme
  localStorage.setItem('kmt_theme', theme)
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>('dark')

  useEffect(() => {
    const preferred = getPreferredTheme()
    setTheme(preferred)
    applyTheme(preferred)
  }, [])

  const nextTheme = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      onClick={() => {
        setTheme(nextTheme)
        applyTheme(nextTheme)
      }}
      className="theme-chip flex items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-colors"
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
    >
      {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
      <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
    </button>
  )
}
