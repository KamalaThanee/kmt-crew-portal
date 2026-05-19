import { getStatusDisplayLabel, normalize } from '@/lib/history'

type StatusPillProps = {
  status?: string | null
  className?: string
}

const getStatusTone = (status: string) => {
  if (status === 'approved') return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
  if (status === 'rejected') return 'text-rose-300 bg-rose-500/10 border-rose-500/20'
  if (status === 'received') return 'text-sky-300 bg-sky-500/10 border-sky-500/20'
  return 'text-amber-300 bg-amber-500/10 border-amber-500/20'
}

export function StatusPill({ status: rawStatus, className = '' }: StatusPillProps) {
  const status = normalize(rawStatus || 'pending')

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${getStatusTone(status)} ${className}`}
    >
      {getStatusDisplayLabel(status)}
    </span>
  )
}
