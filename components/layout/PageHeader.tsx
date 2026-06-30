import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

type PageHeaderProps = {
  title: string
  subtitle: string
  icon: ReactNode
  controls?: ReactNode
  className?: string
  mobileBackHref?: string
  mobileBackLabel?: string
}

export function PageHeader({ title, subtitle, icon, controls, className = '', mobileBackHref, mobileBackLabel = 'Back' }: PageHeaderProps) {
  return (
    <div className={`mb-8 flex flex-col gap-6 md:flex-row md:items-center md:justify-between ${className}`}>
      <div>
        {mobileBackHref && (
          <Link
            href={mobileBackHref}
            className="mb-4 inline-flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--subtle)] shadow-[0_12px_28px_rgba(80,52,16,0.08)] md:hidden"
          >
            <ArrowLeft size={14} />
            {mobileBackLabel}
          </Link>
        )}
        <h1 className="flex items-center gap-3 text-3xl font-black italic uppercase text-[var(--headline)] md:text-4xl">
          {icon}
          {title}
        </h1>
        <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">
          {subtitle}
        </p>
      </div>
      {controls}
    </div>
  )
}
