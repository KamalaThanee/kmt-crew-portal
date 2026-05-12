import Link from 'next/link'
import { Bell, LogOut, Moon, Settings, Sun } from 'lucide-react'
import type { CurrentUser } from '@/lib/currentUser'
import type { KmtTheme } from '@/components/ThemeBridge'

type ProfileMenuProps = {
  user: CurrentUser | null
  isAdmin: boolean
  pushOptedIn: boolean
  theme: KmtTheme
  onEnablePush: () => void
  onToggleTheme: () => void
  onClose: () => void
  onLogout: () => void
}

export function ProfileMenu({
  user,
  isAdmin,
  pushOptedIn,
  theme,
  onEnablePush,
  onToggleTheme,
  onClose,
  onLogout,
}: ProfileMenuProps) {
  return (
    <div className="absolute right-0 top-12 w-64 bg-[var(--nav-bg)] border border-[var(--nav-border)] rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 z-[110] backdrop-blur-2xl">
      <div className="p-6 bg-[var(--card-soft)] border-b border-orange-500/10">
        <p className="text-[var(--app-text)] font-bold text-sm truncate">{user?.full_name}</p>
        <p className="text-orange-500 text-[10px] font-black uppercase mt-1 tracking-widest">{user?.position}</p>
      </div>
      <div className="p-2 space-y-1">
        <button
          onClick={onToggleTheme}
          className="w-full flex items-center gap-3 px-4 py-4 text-xs font-bold text-[var(--text-muted)] hover:text-orange-500 hover:bg-orange-600/10 rounded-2xl transition-all uppercase tracking-widest"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          {theme === 'dark' ? 'Day Mode' : 'Dark Mode'}
        </button>
        {!pushOptedIn && (
          <button
            onClick={onEnablePush}
            className="w-full flex items-center gap-3 px-4 py-4 text-xs font-bold text-emerald-300 hover:text-white hover:bg-emerald-600/10 rounded-2xl transition-all uppercase tracking-widest"
          >
            <Bell size={16} /> Enable Push
          </button>
        )}
        {isAdmin && (
          <Link
            href="/admin/settings"
            onClick={onClose}
            className="w-full flex items-center gap-3 px-4 py-4 text-xs font-bold text-[var(--text-muted)] hover:text-orange-500 hover:bg-orange-600/10 rounded-2xl transition-all uppercase tracking-widest"
          >
            <Settings size={16} /> Admin Panel
          </Link>
        )}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-4 text-xs text-red-400 font-black uppercase tracking-widest hover:bg-red-500/10 rounded-2xl transition-all text-left"
        >
          <LogOut size={16} /> Logout
        </button>
      </div>
    </div>
  )
}
