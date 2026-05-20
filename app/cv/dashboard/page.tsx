'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, FileUser, Search, UserRound } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageShell } from '@/components/layout/PageShell'
import { formatYearsOneDecimal, getSeaServiceMetrics } from '@/lib/cvMetrics'
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

export default function CvDashboardPage() {
  const router = useRouter()
  const [sessionUser, setSessionUser] = useState<CrewRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
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
    setSessionUser(current as CrewRow)
    void loadDashboard()
  }, [router])

  async function loadDashboard() {
    setLoading(true)
    const [crewRes, serviceRes] = await Promise.all([
      supabase
        .from('crews')
        .select('id, full_name, position, cv_last_updated_at')
        .order('full_name', { ascending: true }),
      supabase
        .from('crew_cv_sea_services')
        .select('crew_id, company, vessel_type, rank, joining_date, sign_off_date')
        .order('joining_date', { ascending: false, nullsFirst: false }),
    ])

    setCrews((crewRes.data || []) as CrewRow[])
    setServices((serviceRes.data || []) as SeaServiceRow[])
    setLoading(false)
  }

  const rows = useMemo(() => {
    return crews.map((crew) => {
      const crewServices = services.filter((row) => row.crew_id === crew.id)
      const metrics = getSeaServiceMetrics(crewServices, crew.position)
      return {
        crew,
        metrics,
        entryCount: crewServices.length,
      }
    }).filter(({ crew }) => {
      const keyword = search.trim().toLowerCase()
      if (!keyword) return true
      return `${crew.full_name} ${crew.position || ''}`.toLowerCase().includes(keyword)
    })
  }, [crews, search, services])

  const dashboardSummary = useMemo(() => {
    const crewCount = rows.length
    const totalEntries = rows.reduce((sum, row) => sum + row.entryCount, 0)
    const companyDays = rows.reduce((sum, row) => sum + row.metrics.companyDays, 0)
    const typeDays = rows.reduce((sum, row) => sum + row.metrics.typeDays, 0)
    const rankDays = rows.reduce((sum, row) => sum + row.metrics.rankDays, 0)
    return {
      crewCount,
      totalEntries,
      companyYears: crewCount ? formatYearsOneDecimal(companyDays / crewCount) : '0.0 years',
      typeYears: crewCount ? formatYearsOneDecimal(typeDays / crewCount) : '0.0 years',
      rankYears: crewCount ? formatYearsOneDecimal(rankDays / crewCount) : '0.0 years',
    }
  }, [rows])

  if (loading) {
    return <PageShell><div className="animate-pulse text-[var(--accent-text)]">LOADING CREW CV DASHBOARD...</div></PageShell>
  }

  return (
    <PageShell>
      <PageHeader
        icon={<FileUser className="text-orange-500" size={38} />}
        title="Crew CV Dashboard"
        subtitle="Admin and radio operator review, tenure summary, and export access"
      />

      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <SummaryCard label="Crew Records" value={String(dashboardSummary.crewCount)} detail="Visible after current filter" />
        <SummaryCard label="Year This Company" value={dashboardSummary.companyYears} detail={`${dashboardSummary.totalEntries} sea service row(s)`} />
        <SummaryCard label="Year This Type" value={dashboardSummary.typeYears} detail="Average per visible crew" />
        <SummaryCard label="Year This Rank" value={dashboardSummary.rankYears} detail="Average current rank tenure" />
      </section>

      <section className="mb-6 rounded-[32px] border border-orange-500/20 bg-[var(--surface)] p-4 shadow-xl">
        <div className="flex items-center gap-3 rounded-2xl border border-orange-500/15 bg-[var(--surface-strong)] px-4 py-3">
          <Search className="text-orange-500" size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search crew name or rank..."
            className="w-full bg-transparent text-sm font-black text-[var(--headline)] outline-none placeholder:text-[var(--subtle)]"
          />
        </div>
      </section>

      <section className="space-y-4">
        {rows.map(({ crew, entryCount, metrics }) => (
          <div key={crew.id} className="grid gap-4 rounded-[32px] border border-orange-500/15 bg-[var(--surface)] p-5 shadow-xl xl:grid-cols-[1.2fr_1fr_1fr_auto] xl:items-center">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--accent-text)]">{crew.position || 'Crew'}</p>
              <h2 className="mt-2 text-xl font-black italic uppercase text-[var(--headline)]">{crew.full_name}</h2>
              <p className="mt-2 text-xs text-[var(--subtle)]">Last updated: {formatDateTime(crew.cv_last_updated_at)}</p>
            </div>

            <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-1">
              <MetricMini label="Year This Company" value={metrics.companyText} />
              <MetricMini label="Year This Type" value={metrics.typeText} />
              <MetricMini label="Year This Rank" value={metrics.rankText} />
            </div>

            <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-1">
              <MetricMini label="Current Type" value={metrics.currentType || '-'} compact />
              <MetricMini label="Sea Service Rows" value={String(entryCount)} compact />
              <MetricMini label="Service Total" value={metrics.totalText} compact />
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
        ))}
      </section>
    </PageShell>
  )
}

function SummaryCard({ detail, label, value }: { detail: string; label: string; value: string }) {
  return (
    <div className="rounded-[28px] border border-orange-500/20 bg-[var(--surface)] p-5 shadow-xl">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--accent-text)]">{label}</p>
      <p className="mt-3 text-3xl font-black text-[var(--headline)]">{value}</p>
      <p className="mt-2 text-xs text-[var(--subtle)]">{detail}</p>
    </div>
  )
}

function MetricMini({ compact = false, label, value }: { compact?: boolean; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-orange-500/15 bg-[var(--surface-strong)] p-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">{label}</p>
      <p className={`mt-1 font-black text-[var(--headline)] ${compact ? 'text-sm' : 'text-base'}`}>{value}</p>
    </div>
  )
}
