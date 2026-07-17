'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Activity, Bell, CheckCheck, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageShell } from '@/components/layout/PageShell'
import { readCurrentUser, type CurrentUser } from '@/lib/currentUser'

type ActivityItem = {
  id: string
  href: string
  title: string
  description: string
  meta: string
  isUnread?: boolean
}

type Filter = 'all' | 'unread' | 'read'

export default function NotificationsPage() {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [items, setItems] = useState<ActivityItem[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [readThrough, setReadThrough] = useState('')

  const fetchItems = async (current: CurrentUser) => {
    setLoading(true)
    try {
      const response = await fetch('/api/navbar-notifications?view=all', {
        cache: 'no-store',
        headers: {
          'x-kmt-user-id': String(current.id || ''),
          'x-kmt-pin': String(current.pin || ''),
        },
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to load notifications')
      setItems(payload.adminActions || [])
      setReadThrough(payload.activityReadThrough || '')
    } catch (error: any) {
      toast.error(error?.message || 'Unable to load notifications')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const current = readCurrentUser()
    setUser(current)
    if (current?.id) void fetchItems(current)
    else setLoading(false)
  }, [])

  const filteredItems = useMemo(() => items.filter((item) => (
    filter === 'all' || (filter === 'unread' ? item.isUnread : !item.isUnread)
  )), [filter, items])

  const updateState = async (action: 'mark-read' | 'clear-read') => {
    if (!user?.id) return
    const response = await fetch('/api/navbar-notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-kmt-user-id': String(user.id),
        'x-kmt-pin': String(user.pin || ''),
      },
      body: JSON.stringify({ action, readThrough: readThrough || new Date().toISOString() }),
    })
    if (!response.ok) return toast.error('Unable to update notifications')
    if (action === 'clear-read') setItems((previous) => previous.filter((item) => item.isUnread))
    else setItems((previous) => previous.map((item) => ({ ...item, isUnread: false })))
    window.dispatchEvent(new Event('new-notification'))
  }

  return (
    <PageShell>
      <PageHeader
        title="Notifications"
        subtitle="Recent activity addressed to you · Up to 30 items"
        icon={<Bell size={28} />}
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(['all', 'unread', 'read'] as Filter[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-xl border px-4 py-2 text-[10px] font-black uppercase tracking-widest ${filter === value ? 'border-orange-500 bg-orange-500/15 text-orange-500' : 'border-[var(--card-border)] text-[var(--text-muted)]'}`}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void updateState('mark-read')} className="flex items-center gap-2 rounded-xl border border-emerald-500/20 px-4 py-2 text-[10px] font-black uppercase text-emerald-500">
            <CheckCheck size={14} /> Mark all read
          </button>
          <button type="button" onClick={() => void updateState('clear-read')} className="flex items-center gap-2 rounded-xl border border-zinc-500/20 px-4 py-2 text-[10px] font-black uppercase text-zinc-500">
            <Trash2 size={14} /> Clear read
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="py-16 text-center text-xs font-black uppercase text-[var(--text-muted)]">Loading notifications...</div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-3xl border border-[var(--card-border)] bg-[var(--card-soft)] py-16 text-center text-xs font-black uppercase text-[var(--text-muted)]">No notifications</div>
        ) : filteredItems.map((item) => (
          <Link key={item.id} href={item.href} className={`flex items-start gap-4 rounded-3xl border p-5 transition-colors hover:border-orange-500/40 ${item.isUnread ? 'border-sky-500/30 bg-sky-500/[0.06]' : 'border-[var(--card-border)] bg-[var(--card-soft)]'}`}>
            <div className="rounded-2xl bg-orange-500/10 p-3 text-orange-500"><Activity size={18} /></div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-black text-[var(--app-text)]">{item.title}</p>
                {item.isUnread && <span className="h-2 w-2 shrink-0 rounded-full bg-sky-500" />}
              </div>
              <p className="mt-1 text-sm text-[var(--text-muted)]">{item.description}</p>
              <p className="mt-2 text-[10px] font-bold text-orange-500">{item.meta}</p>
            </div>
          </Link>
        ))}
      </div>
    </PageShell>
  )
}
