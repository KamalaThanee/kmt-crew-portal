import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'

type NotificationTone = 'amber' | 'emerald' | 'red' | 'sky' | 'violet' | 'plain'

type NotificationLinkItemProps = {
  href: string
  title: string
  description?: string
  meta?: string
  badge?: string
  icon: ReactNode
  tone?: NotificationTone
  arrowToneClassName?: string
  onClick: () => void
}

const toneClasses: Record<NotificationTone, { card: string; icon: string; meta: string; arrow: string }> = {
  amber: {
    card: 'border border-amber-500/10 bg-amber-500/[0.04]',
    icon: 'border border-amber-500/20 bg-amber-500/15 text-amber-300',
    meta: 'text-amber-300',
    arrow: 'group-hover:text-orange-400',
  },
  emerald: {
    card: 'border border-emerald-500/10 bg-emerald-500/[0.04]',
    icon: 'bg-emerald-500/20 text-emerald-400',
    meta: 'text-emerald-300',
    arrow: 'group-hover:text-emerald-400',
  },
  red: {
    card: '',
    icon: 'bg-red-500/20 text-red-400',
    meta: 'text-red-300',
    arrow: 'group-hover:text-orange-400',
  },
  sky: {
    card: 'border border-sky-500/10 bg-sky-500/[0.04]',
    icon: 'bg-sky-500/20 text-sky-400',
    meta: 'text-sky-300',
    arrow: 'group-hover:text-sky-400',
  },
  violet: {
    card: 'border border-violet-500/10 bg-violet-500/[0.04]',
    icon: 'bg-violet-500/20 text-violet-300',
    meta: 'text-violet-300',
    arrow: 'group-hover:text-violet-300',
  },
  plain: {
    card: '',
    icon: 'bg-white/5 text-zinc-400',
    meta: 'text-zinc-400',
    arrow: 'group-hover:text-orange-400',
  },
}

export function NotificationLinkItem({
  href,
  title,
  description,
  meta,
  badge,
  icon,
  tone = 'plain',
  arrowToneClassName,
  onClick,
}: NotificationLinkItemProps) {
  const colors = toneClasses[tone]

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center justify-between gap-3 p-4 hover:bg-white/5 rounded-2xl transition-all group ${colors.card}`}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className={`p-2 rounded-xl ${colors.icon}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-white uppercase truncate">{title}</p>
          {description && <p className="text-[9px] text-zinc-400 mt-1 normal-case line-clamp-2">{description}</p>}
          {meta && <p className={`text-[9px] mt-2 normal-case font-black ${colors.meta}`}>{meta}</p>}
        </div>
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0">
        {badge && (
          <span className="px-2 py-1 rounded-md text-[9px] font-black bg-amber-400 text-black">
            {badge}
          </span>
        )}
        <ArrowRight size={14} className={`text-zinc-600 ${arrowToneClassName || colors.arrow} shrink-0`} />
      </div>
    </Link>
  )
}
