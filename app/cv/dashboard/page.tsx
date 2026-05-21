'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, FileUser, Search } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageShell } from '@/components/layout/PageShell'
import { getSeaServiceMetrics } from '@/lib/cvMetrics'
import { readCurrentUser, type CurrentUser } from '@/lib/currentUser'
import { canManageCvDashboard } from '@/lib/roles'
import { supabase } from '@/lib/supabase'

type CrewRow = CurrentUser & {
  id: string
  full_name: string
  position: string | null
  cv_last_updated_at?: string | null
}

type SeaServiceRow = {
  crew_id: string
  company: string | null
  vessel_type: string | null
  rank: string | null
  joining_date: string | null
  sign_off_date: string | null
}

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Never updated'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const clean = (value: unknown) => String(value || '').trim()

export default function CvDashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [nameFilter, setNameFilter] = useState('')
  const [rankFilter, setRankFilter] = useState('All Ranks')
  const [crews, setCrews] = useState<CrewRow[]>([])
  const [services, setServices] = useState<SeaServiceRow[]>([])

  useEffect(() => {
    const current = readCurrentUser()
    if (!current?.id) {
      router.replace('/login')
      return
    }
    if (!canManageCvDashboard(current.position)) {
      router.replace('/cv')
      return
    }
    void loadDashboard()
  }, [router])

  async function loadDashboard() {
    setLoading(true)
    const [crewRes, serviceRes] = await Promise.all([
      supabase.from('crews').select('id, full_name, position, cv_last_updated_at').order('full_name', { ascending: true }),
      supabase
        .from('crew_cv_sea_services')
        .select('crew_id, company, vessel_type, rank, joining_date, sign_off_date')
        .order('joining_date', { ascending: false, nullsFirst: false }),
    ])

    setCrews((crewRes.data || []) as CrewRow[])
    setServices((serviceRes.data || []) as SeaServiceRow[])
    setLoading(false)
  }

  const rankOptions = useMemo(() => {
    const set = new Set<string>()
    crews.forEach((crew) => {
      const rank = clean(crew.position)
      if (rank) set.add(rank)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [crews])

  const crewNameOptions = useMemo(() => {
    return Array.from(new Set(crews.map((crew) => clean(crew.full_name)).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  }, [crews])

  const rows = useMemo(() => {
    const keyword = nameFilter.trim().toLowerCase()
    return crews.filter((crew) => {
      if (rankFilter && clean(crew.position) !== rankFilter) return false
      if (!keyword) return true
      return clean(crew.full_name).toLowerCase().includes(keyword)
    }).map((crew) => ({
      crew,
      services: services.filter((row) => row.crew_id === crew.id),
    }))
  }, [crews, nameFilter, rankFilter, services])

  if (loading) {
    return <PageShell><div className="animate-pulse text-[var(--accent-text)]">LOADING CREW CV DASHBOARD...</div></PageShell>
  }

  return (
    <PageShell>
      <PageHeader
        icon={<FileUser className="text-orange-500" size={38} />}
        title="Crew CV Dashboard"
        subtitle="Admin and radio operator review, tenure filters, and export access"
      />

      <section className="mb-6 rounded-[32px] border border-orange-500/20 bg-[var(--surface)] p-4 shadow-xl">
        <div className="grid gap-3 md:grid-cols-[1.3fr_1fr]">
          <div className="flex items-center gap-3 rounded-2xl border border-orange-500/15 bg-[var(--surface-strong)] px-4 py-3">
            <Search className="text-orange-500" size={18} />
            <input
              list="cv-dashboard-crew-names"
              value={nameFilter}
              onChange={(event) => setNameFilter(event.target.value)}
              placeholder="Search or pick crew name..."
              className="w-full bg-transparent text-sm font-black text-[var(--headline)] outline-none placeholder:text-[var(--subtle)]"
            />
            <datalist id="cv-dashboard-crew-names">
              {crewNameOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-orange-500/15 bg-[var(--surface-strong)] px-4 py-3">
            <Search className="text-orange-500" size={18} />
            <input
              list="cv-dashboard-ranks"
              value={rankFilter}
              onChange={(event) => setRankFilter(event.target.value)}
              placeholder="Search or pick rank..."
              className="w-full bg-transparent text-sm font-black text-[var(--headline)] outline-none placeholder:text-[var(--subtle)]"
            />
            <datalist id="cv-dashboard-ranks">
              {rankOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {rows.map(({ crew, services: crewServices }) => (
          <CrewCvDashboardRow key={crew.id} crew={crew} services={crewServices} />
        ))}
        {rows.length === 0 && (
          <div className="rounded-[32px] border border-orange-500/20 bg-[var(--surface)] p-8 text-center text-sm font-black text-[var(--subtle)] shadow-xl">
            No crew records match this filter.
          </div>
        )}
      </section>
    </PageShell>
  )
}

function CrewCvDashboardRow({ crew, services }: { crew: CrewRow; services: SeaServiceRow[] }) {
  const [selectedCompany, setSelectedCompany] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [selectedRank, setSelectedRank] = useState('')

  const metrics = useMemo(
    () => getSeaServiceMetrics(services, crew.position, selectedType || undefined, selectedCompany || undefined, selectedRank || undefined),
    [crew.position, selectedCompany, selectedRank, selectedType, services],
  )

  useEffect(() => {
    if (!selectedCompany && metrics.currentCompany) setSelectedCompany(metrics.currentCompany)
  }, [metrics.currentCompany, selectedCompany])

  useEffect(() => {
    if (!selectedType && metrics.currentType) setSelectedType(metrics.currentType)
  }, [metrics.currentType, selectedType])

  useEffect(() => {
    if (!selectedRank && metrics.currentRank) setSelectedRank(metrics.currentRank)
  }, [metrics.currentRank, selectedRank])

  return (
    <div className="grid gap-4 rounded-[32px] border border-orange-500/15 bg-[var(--surface)] p-5 shadow-xl xl:grid-cols-[1.15fr_1fr_1fr_auto] xl:items-start">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--accent-text)]">{crew.position || 'Crew'}</p>
        <h2 className="mt-2 text-xl font-black italic uppercase text-[var(--headline)]">{crew.full_name}</h2>
        <p className="mt-2 text-xs text-[var(--subtle)]">Last updated: {formatDateTime(crew.cv_last_updated_at)}</p>
        <p className="mt-2 text-xs font-black uppercase tracking-widest text-[var(--subtle)]">{services.length} sea service row(s)</p>
      </div>

      <div className="grid gap-3">
        <MetricMini label="Year This Company" value={metrics.companyText} detail={metrics.currentCompany || '-'} />
        <MetricMini label="Year This Type" value={metrics.typeText} detail={metrics.currentType || '-'} />
        <MetricMini label="Year This Rank" value={metrics.rankText} detail={metrics.currentRank || crew.position || '-'} />
      </div>

      <div className="grid gap-3">
        <MetricSelect label="Company" value={selectedCompany || metrics.currentCompany || ''} options={metrics.companyOptions} onChange={setSelectedCompany} />
        <MetricSelect label="Type" value={selectedType || metrics.currentType || ''} options={metrics.typeOptions} onChange={setSelectedType} />
        <MetricSelect label="Rank" value={selectedRank || metrics.currentRank || ''} options={metrics.rankOptions} onChange={setSelectedRank} />
      </div>

      <div className="flex flex-col gap-3 xl:items-end">
        <Link href={`/cv?crewId=${crew.id}`} className="rounded-2xl border border-orange-500/30 bg-orange-500/10 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--accent-text)]">
          Open CV
        </Link>
        <Link href={`/cv?crewId=${crew.id}&step=review`} className="rounded-2xl bg-orange-600 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-orange-600/20">
          <Download size={14} className="mr-2 inline" />
          Review & Export
        </Link>
      </div>
    </div>
  )
}

function MetricMini({ detail, label, value }: { detail: string; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-orange-500/15 bg-[var(--surface-strong)] p-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">{label}</p>
      <p className="mt-1 text-lg font-black text-[var(--headline)]">{value}</p>
      <p className="mt-1 text-[11px] font-black text-[var(--subtle)]">{detail}</p>
    </div>
  )
}

function MetricSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string
  onChange: (value: string) => void
  options: string[]
  value: string
}) {
  const normalizedOptions = options.length > 0 ? options : ['-']
  return (
    <label className="space-y-1.5">
      <span className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">{label}</span>
      <select
        value={value || normalizedOptions[0]}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-orange-500/15 bg-[var(--surface-strong)] px-4 py-3 text-xs font-black uppercase tracking-widest text-[var(--headline)] outline-none"
      >
        {normalizedOptions.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  )
}
