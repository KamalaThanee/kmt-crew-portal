import type { ReactNode } from 'react'

type HistoryMetricTone = 'amber' | 'orange' | 'emerald' | 'rose' | 'sky' | 'violet' | 'cyan'

type HistoryMetricCardProps = {
  label: string
  value: ReactNode
  description: ReactNode
  tone: HistoryMetricTone
  icon?: ReactNode
  active?: boolean
  onClick?: () => void
  valueClassName?: string
}

const toneClasses: Record<HistoryMetricTone, { card: string; text: string; description: string; shadow: string }> = {
  amber: {
    card: 'border-amber-400/20 bg-gradient-to-br from-amber-500/14 to-zinc-950',
    text: 'text-amber-200',
    description: 'text-amber-100/70',
    shadow: 'shadow-amber-950/20',
  },
  orange: {
    card: 'border-orange-400/20 bg-gradient-to-br from-orange-500/14 to-zinc-950',
    text: 'text-orange-200',
    description: 'text-orange-100/70',
    shadow: 'shadow-orange-950/20',
  },
  emerald: {
    card: 'border-emerald-400/20 bg-gradient-to-br from-emerald-500/14 to-zinc-950',
    text: 'text-emerald-200',
    description: 'text-emerald-100/70',
    shadow: 'shadow-emerald-950/20',
  },
  rose: {
    card: 'border-rose-400/20 bg-gradient-to-br from-rose-500/14 to-zinc-950',
    text: 'text-rose-200',
    description: 'text-rose-100/70',
    shadow: 'shadow-rose-950/20',
  },
  sky: {
    card: 'border-sky-400/20 bg-gradient-to-br from-sky-500/14 to-zinc-950',
    text: 'text-sky-200',
    description: 'text-sky-100/70',
    shadow: 'shadow-sky-950/20',
  },
  violet: {
    card: 'border-violet-400/20 bg-gradient-to-br from-violet-500/14 to-zinc-950',
    text: 'text-violet-200',
    description: 'text-violet-100/70',
    shadow: 'shadow-violet-950/20',
  },
  cyan: {
    card: 'border-cyan-400/20 bg-gradient-to-br from-cyan-500/14 to-zinc-950',
    text: 'text-cyan-200',
    description: 'text-cyan-100/70',
    shadow: 'shadow-cyan-950/20',
  },
}

export function HistoryMetricCard({
  label,
  value,
  description,
  tone,
  icon,
  active = false,
  onClick,
  valueClassName = 'text-3xl',
}: HistoryMetricCardProps) {
  const colors = toneClasses[tone]
  const className = `rounded-[28px] border ${colors.card} p-5 text-left shadow-xl ${colors.shadow} transition-all ${
    active ? 'ring-2 ring-white/30' : onClick ? 'hover:border-white/30' : ''
  }`
  const content = (
    <>
      <div className={`flex items-center gap-2 ${colors.text}`}>
        {icon}
        <p className="text-[9px] uppercase tracking-widest">{label}</p>
      </div>
      <p className={`mt-3 font-black text-white normal-case ${valueClassName}`}>{value}</p>
      <p className={`mt-2 text-xs font-semibold ${colors.description}`}>{description}</p>
    </>
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    )
  }

  return <div className={className}>{content}</div>
}
