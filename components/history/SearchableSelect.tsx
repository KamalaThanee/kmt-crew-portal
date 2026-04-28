import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

type SearchableSelectProps = {
  icon: ReactNode
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  options: string[]
  toneClassName: string
}

const normalize = (value: string) => String(value || '').toLowerCase().trim()

export function SearchableSelect({
  icon,
  label,
  placeholder,
  value,
  onChange,
  options,
  toneClassName,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setQuery(value)
  }, [value])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  const filteredOptions = useMemo(() => {
    const q = normalize(query)
    if (!q) return options.slice(0, 12)
    return options.filter((option) => normalize(option).includes(q)).slice(0, 12)
  }, [options, query])

  const applyValue = (nextValue: string) => {
    setQuery(nextValue)
    onChange(nextValue)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className={`relative ${toneClassName}`}>
      <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
        {icon}
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          const nextValue = e.target.value
          setQuery(nextValue)
          onChange(nextValue)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full rounded-2xl border bg-zinc-950/70 py-3 pl-11 pr-12 text-sm font-semibold text-white outline-none transition placeholder:text-zinc-500 focus:bg-zinc-950"
      />
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-1 text-zinc-500 transition hover:text-white"
        aria-label={`Toggle ${label} options`}
      >
        <ChevronDown size={16} className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-2xl border border-white/10 bg-[#090d18] shadow-2xl">
          <div className="border-b border-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
            {label}
          </div>
          <button
            type="button"
            onClick={() => applyValue('')}
            className="block w-full border-b border-white/5 px-4 py-3 text-left text-sm font-semibold text-zinc-400 transition hover:bg-white/5 hover:text-white"
          >
            All
          </button>
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => applyValue(option)}
                className="block w-full px-4 py-3 text-left text-sm font-semibold text-white transition hover:bg-white/5"
              >
                {option}
              </button>
            ))
          ) : (
            <div className="px-4 py-4 text-sm font-semibold text-zinc-500">No match found</div>
          )}
        </div>
      )}
    </div>
  )
}
