import type { ReactNode } from 'react'

type PageShellProps = {
  children: ReactNode
  className?: string
}

export function PageShell({ children, className = '' }: PageShellProps) {
  return (
    <div className={`mx-auto max-w-7xl p-4 pb-32 pt-10 font-sans text-[10px] font-bold uppercase text-[var(--headline)] md:p-8 md:pt-28 ${className}`}>
      {children}
    </div>
  )
}
