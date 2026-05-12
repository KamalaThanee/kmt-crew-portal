import type { ReactNode } from 'react'

type PageHeaderProps = {
  title: string
  subtitle: string
  icon: ReactNode
  controls?: ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, icon, controls, className = '' }: PageHeaderProps) {
  return (
    <div className={`mb-8 flex flex-col gap-6 md:flex-row md:items-center md:justify-between ${className}`}>
      <div>
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
