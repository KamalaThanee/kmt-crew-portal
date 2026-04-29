'use client'

import { Package, Search, User } from 'lucide-react'
import { formatMonthOption } from '@/lib/history'
import { SearchableSelect } from '@/components/history/SearchableSelect'

type HistoryFilterBarProps = {
  crewOptions: string[]
  itemOptions: string[]
  monthFilter: string
  monthOptions: string[]
  searchCrew: string
  searchItem: string
  statusFilter: string
  yearFilter: string
  yearOptions: string[]
  onMonthFilterChange: (value: string) => void
  onSearchCrewChange: (value: string) => void
  onSearchItemChange: (value: string) => void
  onStatusFilterChange: (value: string) => void
  onYearFilterChange: (value: string) => void
}

export function HistoryFilterBar({
  crewOptions,
  itemOptions,
  monthFilter,
  monthOptions,
  searchCrew,
  searchItem,
  statusFilter,
  yearFilter,
  yearOptions,
  onMonthFilterChange,
  onSearchCrewChange,
  onSearchItemChange,
  onStatusFilterChange,
  onYearFilterChange,
}: HistoryFilterBarProps) {
  return (
    <div className="mb-8 rounded-[32px] border border-white/6 bg-zinc-950/45 p-4 shadow-xl shadow-black/20">
      <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">
        <Search size={14} className="text-orange-400" />
        Filter History
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[1.1fr_1fr_0.8fr_0.8fr_0.8fr]">
        <SearchableSelect
          icon={<User size={16} />}
          label="Crew"
          placeholder="Search or pick crew..."
          value={searchCrew}
          onChange={onSearchCrewChange}
          options={crewOptions}
          toneClassName="[&_input]:border-emerald-500/25 [&_input]:focus:border-emerald-400"
        />

        <SearchableSelect
          icon={<Package size={16} />}
          label="Item"
          placeholder="Search or pick item..."
          value={searchItem}
          onChange={onSearchItemChange}
          options={itemOptions}
          toneClassName="[&_input]:border-sky-500/25 [&_input]:focus:border-sky-400"
        />

        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="rounded-2xl border border-rose-500/25 bg-zinc-950/70 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-rose-400"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="received">Received</option>
        </select>

        <select
          value={monthFilter}
          onChange={(e) => onMonthFilterChange(e.target.value)}
          className="rounded-2xl border border-amber-500/25 bg-zinc-950/70 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-amber-400"
        >
          <option value="all">All Months</option>
          {monthOptions.map((option) => (
            <option key={option} value={option}>
              {formatMonthOption(option)}
            </option>
          ))}
        </select>

        <select
          value={yearFilter}
          onChange={(e) => onYearFilterChange(e.target.value)}
          className="rounded-2xl border border-violet-500/25 bg-zinc-950/70 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-violet-400"
        >
          <option value="all">All Years</option>
          {yearOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
