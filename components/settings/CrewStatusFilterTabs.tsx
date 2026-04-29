'use client'

import type { CrewStatusFilter } from '@/lib/settings'

type CrewStatusFilterTabsProps = {
  value: CrewStatusFilter
  onChange: (value: CrewStatusFilter) => void
}

const FILTERS: Array<[CrewStatusFilter, string]> = [
  ['active', 'Active Crew'],
  ['resigned', 'Resigned'],
  ['all', 'All Crew'],
]

export function CrewStatusFilterTabs({ value, onChange }: CrewStatusFilterTabsProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {FILTERS.map(([filterValue, label]) => (
        <button
          key={filterValue}
          onClick={() => onChange(filterValue)}
          className={`px-5 py-3 rounded-2xl border text-[10px] font-black uppercase transition-all ${
            value === filterValue
              ? 'bg-orange-600 border-orange-400 text-white shadow-lg shadow-orange-600/20'
              : 'bg-black/40 border-white/10 text-zinc-500 hover:text-orange-400'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
