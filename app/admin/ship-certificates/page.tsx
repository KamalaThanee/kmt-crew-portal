'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CalendarClock, FileBadge, Search, ShipWheel } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { canViewShipCertificates } from '@/lib/roles'
import { readCurrentUser } from '@/lib/currentUser'
import {
  daysUntil,
  formatShipDate,
  getShipCertificateStatus,
  getShipStatusLabel,
  getShipSurveyStatus,
  getSurveyStatusLabel,
  shipStatusStyles,
  shipSurveyStyles,
  type ShipCertificate,
  type ShipCertificateStatus,
} from '@/lib/shipCertificates'

const categories = ['all', 'Flag', 'Class', 'Insurance', 'Permit', 'GMDSS', 'FFE', 'LSA']
const statusFilters: Array<'all' | ShipCertificateStatus> = ['all', 'expired', 'due-30', 'due-60', 'due-90', 'due-180', 'valid', 'no-expiry']

export default function ShipCertificatesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<ShipCertificate[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    const user = readCurrentUser()
    if (!user) {
      router.replace('/login')
      return
    }
    if (!canViewShipCertificates(user.position)) {
      router.replace('/dashboard')
      return
    }

    const fetchData = async () => {
      setLoading(true)
      setErrorMessage('')
      const { data, error } = await supabase
        .from('ship_certificates')
        .select('*')
        .order('sort_order', { ascending: true })

      if (error) {
        setErrorMessage(error.message)
        setRows([])
      } else {
        setRows((data || []) as ShipCertificate[])
      }
      setLoading(false)
    }

    fetchData()
  }, [router])

  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    return rows.filter((row) => {
      const status = getShipCertificateStatus(row)
      const text = [row.code, row.cert_name, row.issue_by, row.remark, row.category].filter(Boolean).join(' ').toLowerCase()
      return (
        (!query || text.includes(query)) &&
        (categoryFilter === 'all' || row.category === categoryFilter) &&
        (statusFilter === 'all' || status === statusFilter)
      )
    })
  }, [categoryFilter, rows, searchTerm, statusFilter])

  const summary = useMemo(() => {
    const counts = {
      total: rows.length,
      expired: 0,
      due30: 0,
      due90: 0,
      surveyDue: 0,
      noExpiry: 0,
    }

    for (const row of rows) {
      const status = getShipCertificateStatus(row)
      const survey = getShipSurveyStatus(row)
      if (status === 'expired') counts.expired += 1
      if (status === 'due-30') counts.due30 += 1
      if (['due-30', 'due-60', 'due-90'].includes(status)) counts.due90 += 1
      if (status === 'no-expiry') counts.noExpiry += 1
      if (['survey-overdue', 'survey-due-30', 'survey-due-60', 'survey-due-90'].includes(survey)) counts.surveyDue += 1
    }

    return counts
  }, [rows])

  if (loading) {
    return <div className="min-h-screen bg-black pt-32 text-center text-orange-500 font-black animate-pulse">LOADING SHIP CERTIFICATES...</div>
  }

  return (
    <div className="min-h-screen bg-[#050817] px-4 pb-32 pt-24 text-white md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <ShipWheel className="text-cyan-300" size={34} />
              <h1 className="text-4xl font-black italic tracking-tight md:text-5xl">Ship Certificate</h1>
            </div>
            <p className="mt-2 text-[10px] font-black uppercase tracking-[0.35em] text-cyan-200/70">
              Vessel compliance, expiry, and class survey control
            </p>
          </div>
          <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/10 px-5 py-4 text-xs normal-case text-cyan-100">
            Phase 1: checklist foundation from document 11.62
          </div>
        </header>

        {errorMessage && (
          <div className="rounded-[32px] border border-orange-500/30 bg-orange-500/10 p-6 text-sm normal-case text-orange-100">
            <p className="font-black uppercase tracking-widest text-orange-300">Ship certificate tables not ready</p>
            <p className="mt-2">Run <span className="font-black text-white">sql/ship_certificates.sql</span> in Supabase first.</p>
            <p className="mt-1 text-orange-200/70">{errorMessage}</p>
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <SummaryCard label="Total" value={summary.total} tone="cyan" detail="All ship records" />
          <SummaryCard label="Expired" value={summary.expired} tone="red" detail="Needs immediate action" />
          <SummaryCard label="Due 30d" value={summary.due30} tone="orange" detail="Renew now" />
          <SummaryCard label="Due 90d" value={summary.due90} tone="amber" detail="Planning window" />
          <SummaryCard label="Survey Due" value={summary.surveyDue} tone="purple" detail="Class endorsement" />
        </section>

        <section className="rounded-[34px] border border-white/10 bg-black/30 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_180px]">
            <label className="flex items-center gap-3 rounded-2xl border border-cyan-500/20 bg-black/40 px-4">
              <Search size={16} className="text-cyan-300" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search certificate, issuer, remark..."
                className="h-14 w-full bg-transparent text-sm font-bold text-white outline-none placeholder:text-zinc-600"
              />
            </label>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="h-14 rounded-2xl border border-cyan-500/20 bg-black/60 px-4 text-xs font-black uppercase text-white outline-none">
              {categories.map((category) => <option key={category} value={category}>{category === 'all' ? 'All Categories' : category}</option>)}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-14 rounded-2xl border border-cyan-500/20 bg-black/60 px-4 text-xs font-black uppercase text-white outline-none">
              {statusFilters.map((status) => <option key={status} value={status}>{status === 'all' ? 'All Status' : getShipStatusLabel(status)}</option>)}
            </select>
          </div>
        </section>

        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
          {filteredRows.length} shown / {rows.length} total records
        </p>

        <section className="overflow-hidden rounded-[34px] border border-white/10 bg-black/30">
          <div className="hidden grid-cols-[90px_130px_1fr_150px_150px_170px_170px] gap-4 border-b border-white/10 px-6 py-5 text-[9px] font-black uppercase tracking-widest text-zinc-500 md:grid">
            <span>Code</span>
            <span>Category</span>
            <span>Certificate</span>
            <span>Expiry</span>
            <span>Status</span>
            <span>Survey</span>
            <span>Remark</span>
          </div>
          {filteredRows.length === 0 ? (
            <div className="p-12 text-center text-sm font-black uppercase tracking-widest text-zinc-600">
              No ship certificates found
            </div>
          ) : filteredRows.map((row) => (
            <ShipCertificateRow key={row.id || `${row.category}-${row.code}-${row.cert_name}`} row={row} />
          ))}
        </section>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, detail, tone }: { label: string; value: number; detail: string; tone: 'cyan' | 'red' | 'orange' | 'amber' | 'purple' }) {
  const tones = {
    cyan: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200',
    red: 'border-red-500/20 bg-red-500/10 text-red-200',
    orange: 'border-orange-500/20 bg-orange-500/10 text-orange-200',
    amber: 'border-amber-500/20 bg-amber-500/10 text-amber-200',
    purple: 'border-purple-500/20 bg-purple-500/10 text-purple-200',
  }

  return (
    <button className={`rounded-[32px] border p-6 text-left shadow-xl transition-all hover:-translate-y-0.5 ${tones[tone]}`}>
      <p className="text-[9px] font-black uppercase tracking-[0.3em]">{label}</p>
      <p className="mt-5 text-4xl font-black text-white">{value}</p>
      <p className="mt-2 text-xs normal-case text-zinc-300">{detail}</p>
    </button>
  )
}

function ShipCertificateRow({ row }: { row: ShipCertificate }) {
  const status = getShipCertificateStatus(row)
  const surveyStatus = getShipSurveyStatus(row)
  const expiryDays = daysUntil(row.expiry_date)
  const surveyDays = daysUntil(row.next_survey_date)

  return (
    <article className="grid grid-cols-1 gap-4 border-b border-white/5 px-5 py-5 last:border-0 md:grid-cols-[90px_130px_1fr_150px_150px_170px_170px] md:items-center md:px-6">
      <div>
        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 md:hidden">Code</p>
        <p className="font-black text-cyan-200">{row.code || '-'}</p>
      </div>
      <div>
        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 md:hidden">Category</p>
        <p className="text-xs font-black uppercase text-zinc-300">{row.category || '-'}</p>
      </div>
      <div>
        <p className="text-base font-black uppercase italic text-white">{row.cert_name || 'Unknown certificate'}</p>
        <p className="mt-1 text-[11px] normal-case text-zinc-500">
          Issue by {row.issue_by || '-'} · Issued {formatShipDate(row.issued_date)}
        </p>
      </div>
      <div>
        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 md:hidden">Expiry</p>
        <p className="text-sm font-black text-white">{formatShipDate(row.expiry_date)}</p>
        {expiryDays !== null && <p className="mt-1 text-[10px] text-zinc-500">{expiryDays} days</p>}
      </div>
      <span className={`w-fit rounded-full border px-3 py-2 text-[9px] font-black uppercase tracking-widest ${shipStatusStyles[status]}`}>
        {getShipStatusLabel(status)}
      </span>
      <div className={`rounded-2xl border px-3 py-2 text-[9px] font-black uppercase tracking-widest ${shipSurveyStyles[surveyStatus]}`}>
        <div className="flex items-center gap-2">
          {surveyStatus.includes('due') || surveyStatus.includes('overdue') ? <AlertTriangle size={12} /> : <CalendarClock size={12} />}
          <span>{getSurveyStatusLabel(surveyStatus)}</span>
        </div>
        {row.next_survey_date && (
          <p className="mt-1 text-[10px] normal-case text-zinc-300">
            Next {formatShipDate(row.next_survey_date)} {surveyDays !== null ? `(${surveyDays}d)` : ''}
          </p>
        )}
      </div>
      <div className="text-[11px] normal-case text-zinc-400">
        <div className="flex items-center gap-2">
          <FileBadge size={13} className="text-zinc-600" />
          <span>{row.remark || '-'}</span>
        </div>
      </div>
    </article>
  )
}
