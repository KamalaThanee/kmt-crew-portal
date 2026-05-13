'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BriefcaseBusiness, CalendarDays, Plus, Save, Ship, Trash2, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageShell } from '@/components/layout/PageShell'
import { readCurrentUser, type CurrentUser } from '@/lib/currentUser'
import { isAdminRole } from '@/lib/roles'
import { supabase } from '@/lib/supabase'

type VesselMaster = {
  id: string
  vessel_name: string
  vessel_type: string | null
  flag: string | null
  imo_no: string | null
  grt: string | null
  dwt: string | null
  engine_type: string | null
  bhp: string | null
  company: string | null
  trading_area: string | null
}

type SeaServiceForm = Omit<VesselMaster, 'id'> & {
  crew_id: string
  vessel_master_id: string | null
  rank: string | null
  joining_date: string | null
  sign_off_date: string | null
  remarks: string | null
}

type SeaServiceRow = SeaServiceForm & {
  id: string
}

type CvProfile = {
  national_id_no: string
  nationality: string
  date_of_birth: string
  place_of_birth: string
  cv_company: string
}

const emptyProfile: CvProfile = {
  national_id_no: '',
  nationality: '',
  date_of_birth: '',
  place_of_birth: '',
  cv_company: '',
}

const emptySeaService: SeaServiceForm = {
  crew_id: '',
  vessel_master_id: null,
  vessel_name: '',
  vessel_type: '',
  flag: '',
  imo_no: '',
  grt: '',
  dwt: '',
  engine_type: '',
  bhp: '',
  company: '',
  trading_area: '',
  rank: '',
  joining_date: '',
  sign_off_date: '',
  remarks: '',
}

const clean = (value: unknown) => String(value || '').trim()

const toDateValue = (value?: string | null) => {
  if (!value) return ''
  return String(value).slice(0, 10)
}

const dayDiffInclusive = (start?: string | null, end?: string | null) => {
  if (!start || !end) return 0
  const startDate = new Date(`${start}T00:00:00`)
  const endDate = new Date(`${end}T00:00:00`)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0
  const diff = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1
  return Math.max(diff, 0)
}

const formatServiceDuration = (days: number) => {
  const months = Math.floor(days / 30)
  const remainder = days % 30
  if (!days) return '0 months 0 days'
  return `${months} months ${remainder} days`
}

const formatDate = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function CvPage() {
  const router = useRouter()
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [sqlMissing, setSqlMissing] = useState(false)
  const [profile, setProfile] = useState<CvProfile>(emptyProfile)
  const [vessels, setVessels] = useState<VesselMaster[]>([])
  const [services, setServices] = useState<SeaServiceRow[]>([])
  const [serviceForm, setServiceForm] = useState<SeaServiceForm>(emptySeaService)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingService, setSavingService] = useState(false)
  const [selectedVesselId, setSelectedVesselId] = useState('')

  useEffect(() => {
    const current = readCurrentUser()
    if (!current?.id) {
      router.replace('/login')
      return
    }
    const currentId = current.id
    setUser(current)
    setProfile({
      national_id_no: clean((current as any).national_id_no),
      nationality: clean((current as any).nationality),
      date_of_birth: toDateValue((current as any).date_of_birth),
      place_of_birth: clean((current as any).place_of_birth),
      cv_company: clean((current as any).cv_company || 'TMS'),
    })
    setServiceForm((prev) => ({ ...prev, crew_id: currentId, rank: current.position || '' }))
    loadCv(current)
  }, [router])

  const admin = isAdminRole(user?.position)

  const serviceSummary = useMemo(() => {
    const totalDays = services.reduce((sum, row) => sum + dayDiffInclusive(row.joining_date, row.sign_off_date), 0)
    return {
      totalDays,
      totalText: formatServiceDuration(totalDays),
      vesselCount: new Set(services.map((row) => row.vessel_name).filter(Boolean)).size,
    }
  }, [services])

  async function loadCv(current: CurrentUser) {
    setLoading(true)
    setSqlMissing(false)
    const [vesselRes, serviceRes] = await Promise.all([
      supabase.from('cv_vessel_master').select('*').order('vessel_name', { ascending: true }),
      supabase
        .from('crew_cv_sea_services')
        .select('*')
        .eq('crew_id', current.id)
        .order('joining_date', { ascending: false }),
    ])

    if (vesselRes.error || serviceRes.error) {
      setSqlMissing(true)
      setLoading(false)
      return
    }

    setVessels((vesselRes.data || []) as VesselMaster[])
    setServices((serviceRes.data || []) as SeaServiceRow[])
    setLoading(false)
  }

  function applyVesselShortcut(vesselId: string) {
    setSelectedVesselId(vesselId)
    const vessel = vessels.find((item) => item.id === vesselId)
    if (!vessel) return
    setServiceForm((prev) => ({
      ...prev,
      vessel_master_id: vessel.id,
      vessel_name: vessel.vessel_name || '',
      vessel_type: vessel.vessel_type || '',
      flag: vessel.flag || '',
      imo_no: vessel.imo_no || '',
      grt: vessel.grt || '',
      dwt: vessel.dwt || '',
      engine_type: vessel.engine_type || '',
      bhp: vessel.bhp || '',
      company: vessel.company || '',
      trading_area: vessel.trading_area || '',
    }))
  }

  async function saveProfile() {
    if (!user?.id) return
    setSavingProfile(true)
    const payload = {
      national_id_no: profile.national_id_no || null,
      nationality: profile.nationality || null,
      date_of_birth: profile.date_of_birth || null,
      place_of_birth: profile.place_of_birth || null,
      cv_company: profile.cv_company || null,
      cv_last_updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('crews').update(payload).eq('id', user.id)
    setSavingProfile(false)
    if (error) {
      toast.error(`${error.message}. Run sql/crew_cv_foundation.sql first.`)
      return
    }
    const nextUser = { ...user, ...payload }
    localStorage.setItem('kmt_user', JSON.stringify(nextUser))
    window.dispatchEvent(new Event('kmt-user-changed'))
    setUser(nextUser)
    toast.success('CV profile saved')
  }

  async function saveVesselShortcut() {
    if (!admin || !serviceForm.vessel_name) return
    const payload = buildVesselPayload(serviceForm, user)
    const { data, error } = await supabase
      .from('cv_vessel_master')
      .upsert(payload, { onConflict: 'vessel_name' })
      .select('*')
      .single()

    if (error) {
      toast.error(error.message)
      return
    }
    const nextVessels = [...vessels.filter((item) => item.id !== data.id && item.vessel_name !== data.vessel_name), data as VesselMaster]
      .sort((a, b) => a.vessel_name.localeCompare(b.vessel_name))
    setVessels(nextVessels)
    setSelectedVesselId(data.id)
    setServiceForm((prev) => ({ ...prev, vessel_master_id: data.id }))
    toast.success('Vessel shortcut saved')
  }

  async function saveSeaService() {
    if (!user?.id) return
    if (!serviceForm.vessel_name || !serviceForm.rank || !serviceForm.joining_date || !serviceForm.sign_off_date) {
      toast.error('Please fill vessel, rank, joining date, and sign off date')
      return
    }
    setSavingService(true)
    const payload = {
      ...buildSeaServicePayload(serviceForm),
      crew_id: user.id,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('crew_cv_sea_services').insert(payload)
    setSavingService(false)
    if (error) {
      toast.error(`${error.message}. Run sql/crew_cv_foundation.sql first.`)
      return
    }
    toast.success('Sea service added')
    setServiceForm({ ...emptySeaService, crew_id: user.id, rank: user.position || '' })
    setSelectedVesselId('')
    await loadCv(user)
  }

  async function deleteSeaService(id: string) {
    const { error } = await supabase.from('crew_cv_sea_services').delete().eq('id', id)
    if (error) {
      toast.error(error.message)
      return
    }
    setServices((prev) => prev.filter((item) => item.id !== id))
    toast.success('Sea service deleted')
  }

  if (loading) {
    return <PageShell><div className="animate-pulse text-[var(--accent-text)]">LOADING CV...</div></PageShell>
  }

  return (
    <PageShell>
      <PageHeader
        icon={<UserRound className="text-orange-500" size={38} />}
        title="Crew CV"
        subtitle="Personal record, certificates, and sea service profile"
      />

      {sqlMissing && (
        <div className="mb-6 rounded-[32px] border border-amber-500/30 bg-amber-500/10 p-6 text-[var(--headline)]">
          <p className="text-sm font-black uppercase text-[var(--warning-text)]">CV database is not ready</p>
          <p className="mt-2 text-xs normal-case text-[var(--subtle)]">
            Run `sql/crew_cv_foundation.sql` in Supabase SQL Editor, then refresh this page.
          </p>
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Sea Service" value={serviceSummary.totalText} detail={`${serviceSummary.totalDays} total days`} />
        <MetricCard label="Vessels" value={String(serviceSummary.vesselCount)} detail="Unique vessel names" />
        <MetricCard label="Entries" value={String(services.length)} detail="Recorded service rows" />
      </section>

      <section className="mt-6 rounded-[36px] border border-orange-500/20 bg-[var(--surface)] p-6 shadow-xl">
        <div className="mb-5 flex items-center gap-3">
          <BriefcaseBusiness className="text-orange-500" />
          <div>
            <h2 className="text-xl font-black italic uppercase text-[var(--headline)]">Personal CV Data</h2>
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">Passport upload can prefill these fields</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <TextField label="National ID No." value={profile.national_id_no} onChange={(value) => setProfile((prev) => ({ ...prev, national_id_no: value }))} />
          <TextField label="Nationality" value={profile.nationality} onChange={(value) => setProfile((prev) => ({ ...prev, nationality: value }))} />
          <DateField label="Date of Birth" value={profile.date_of_birth} onChange={(value) => setProfile((prev) => ({ ...prev, date_of_birth: value }))} />
          <TextField label="Place of Birth" value={profile.place_of_birth} onChange={(value) => setProfile((prev) => ({ ...prev, place_of_birth: value }))} />
          <TextField label="Company" value={profile.cv_company} onChange={(value) => setProfile((prev) => ({ ...prev, cv_company: value }))} />
        </div>
        <button onClick={saveProfile} disabled={savingProfile || sqlMissing} className="mt-5 rounded-2xl bg-orange-600 px-6 py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-orange-600/20 disabled:opacity-50">
          <Save size={15} className="mr-2 inline" /> {savingProfile ? 'Saving...' : 'Save CV Profile'}
        </button>
      </section>

      <section className="mt-6 rounded-[36px] border border-orange-500/20 bg-[var(--surface)] p-6 shadow-xl">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Ship className="text-orange-500" />
            <div>
              <h2 className="text-xl font-black italic uppercase text-[var(--headline)]">Sea Service Shortcut</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">Select vessel, then only fill rank and dates</p>
            </div>
          </div>
          <select value={selectedVesselId} onChange={(event) => applyVesselShortcut(event.target.value)} className="rounded-2xl border border-orange-500/20 bg-[var(--surface-strong)] px-4 py-3 text-xs font-black text-[var(--headline)]">
            <option value="">Select saved vessel shortcut...</option>
            {vessels.map((vessel) => (
              <option key={vessel.id} value={vessel.id}>{vessel.vessel_name}</option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <TextField label="Name of Vessel" value={serviceForm.vessel_name || ''} onChange={(value) => setServiceForm((prev) => ({ ...prev, vessel_name: value, vessel_master_id: null }))} />
          <TextField label="Vessel Type" value={serviceForm.vessel_type || ''} onChange={(value) => setServiceForm((prev) => ({ ...prev, vessel_type: value }))} />
          <TextField label="Flag" value={serviceForm.flag || ''} onChange={(value) => setServiceForm((prev) => ({ ...prev, flag: value }))} />
          <TextField label="IMO No." value={serviceForm.imo_no || ''} onChange={(value) => setServiceForm((prev) => ({ ...prev, imo_no: value }))} />
          <TextField label="GRT" value={serviceForm.grt || ''} onChange={(value) => setServiceForm((prev) => ({ ...prev, grt: value }))} />
          <TextField label="DWT" value={serviceForm.dwt || ''} onChange={(value) => setServiceForm((prev) => ({ ...prev, dwt: value }))} />
          <TextField label="Engine Type" value={serviceForm.engine_type || ''} onChange={(value) => setServiceForm((prev) => ({ ...prev, engine_type: value }))} />
          <TextField label="BHP" value={serviceForm.bhp || ''} onChange={(value) => setServiceForm((prev) => ({ ...prev, bhp: value }))} />
          <TextField label="Company" value={serviceForm.company || ''} onChange={(value) => setServiceForm((prev) => ({ ...prev, company: value }))} />
          <TextField label="Trading Area" value={serviceForm.trading_area || ''} onChange={(value) => setServiceForm((prev) => ({ ...prev, trading_area: value }))} />
          <TextField label="Rank" value={serviceForm.rank || ''} onChange={(value) => setServiceForm((prev) => ({ ...prev, rank: value }))} />
          <TextField label="Remarks" value={serviceForm.remarks || ''} onChange={(value) => setServiceForm((prev) => ({ ...prev, remarks: value }))} />
          <DateField label="Joining Date" value={serviceForm.joining_date || ''} onChange={(value) => setServiceForm((prev) => ({ ...prev, joining_date: value }))} />
          <DateField label="Sign Off Date" value={serviceForm.sign_off_date || ''} onChange={(value) => setServiceForm((prev) => ({ ...prev, sign_off_date: value }))} />
        </div>

        <div className="mt-5 flex flex-col gap-3 md:flex-row">
          <button onClick={saveSeaService} disabled={savingService || sqlMissing} className="rounded-2xl bg-orange-600 px-6 py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-orange-600/20 disabled:opacity-50">
            <Plus size={15} className="mr-2 inline" /> {savingService ? 'Saving...' : 'Add Sea Service'}
          </button>
          {admin && (
            <button onClick={saveVesselShortcut} disabled={!serviceForm.vessel_name || sqlMissing} className="rounded-2xl border border-orange-500/30 bg-orange-500/10 px-6 py-4 text-xs font-black uppercase tracking-widest text-[var(--accent-text)] disabled:opacity-50">
              <Ship size={15} className="mr-2 inline" /> Save / Update Vessel Shortcut
            </button>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-[36px] border border-orange-500/20 bg-[var(--surface)] p-6 shadow-xl">
        <h2 className="mb-5 text-xl font-black italic uppercase text-[var(--headline)]">Sea Service History</h2>
        <div className="space-y-3">
          {services.length === 0 && <div className="rounded-3xl bg-[var(--surface-strong)] p-6 text-[var(--subtle)]">No sea service records yet.</div>}
          {services.map((row) => {
            const days = dayDiffInclusive(row.joining_date, row.sign_off_date)
            return (
              <div key={row.id} className="grid gap-4 rounded-3xl border border-orange-500/15 bg-[var(--surface-strong)] p-5 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-center">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--accent-text)]">{row.vessel_type || 'Vessel'}</p>
                  <h3 className="mt-1 text-lg font-black italic uppercase text-[var(--headline)]">{row.vessel_name}</h3>
                  <p className="mt-1 text-xs normal-case text-[var(--subtle)]">{row.flag || '-'} | GRT {row.grt || '-'} | DWT {row.dwt || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">Rank</p>
                  <p className="text-sm font-black text-[var(--headline)]">{row.rank || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">Period</p>
                  <p className="text-sm font-black text-[var(--headline)]">{formatDate(row.joining_date)} - {formatDate(row.sign_off_date)}</p>
                  <p className="mt-1 text-[10px] font-black uppercase text-[var(--accent-text)]">{formatServiceDuration(days)}</p>
                </div>
                <button onClick={() => deleteSeaService(row.id)} className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs font-black uppercase text-[var(--danger-text)]">
                  <Trash2 size={14} className="mr-2 inline" /> Delete
                </button>
              </div>
            )
          })}
        </div>
      </section>
    </PageShell>
  )
}

function buildVesselPayload(form: SeaServiceForm, user: CurrentUser | null) {
  return {
    vessel_name: clean(form.vessel_name),
    vessel_type: clean(form.vessel_type) || null,
    flag: clean(form.flag) || null,
    imo_no: clean(form.imo_no) || null,
    grt: clean(form.grt) || null,
    dwt: clean(form.dwt) || null,
    engine_type: clean(form.engine_type) || null,
    bhp: clean(form.bhp) || null,
    company: clean(form.company) || null,
    trading_area: clean(form.trading_area) || null,
    created_by: user?.id || null,
    created_by_name: user?.full_name || null,
    updated_at: new Date().toISOString(),
  }
}

function buildSeaServicePayload(form: SeaServiceForm) {
  return {
    vessel_master_id: form.vessel_master_id || null,
    vessel_name: clean(form.vessel_name),
    vessel_type: clean(form.vessel_type) || null,
    flag: clean(form.flag) || null,
    imo_no: clean(form.imo_no) || null,
    grt: clean(form.grt) || null,
    dwt: clean(form.dwt) || null,
    engine_type: clean(form.engine_type) || null,
    bhp: clean(form.bhp) || null,
    company: clean(form.company) || null,
    trading_area: clean(form.trading_area) || null,
    rank: clean(form.rank) || null,
    joining_date: form.joining_date || null,
    sign_off_date: form.sign_off_date || null,
    remarks: clean(form.remarks) || null,
  }
}

function MetricCard({ detail, label, value }: { detail: string; label: string; value: string }) {
  return (
    <div className="rounded-[32px] border border-orange-500/20 bg-[var(--surface)] p-6 shadow-xl">
      <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[var(--accent-text)]">{label}</p>
      <p className="mt-4 text-3xl font-black text-[var(--headline)]">{value}</p>
      <p className="mt-1 text-xs normal-case text-[var(--subtle)]">{detail}</p>
    </div>
  )
}

function TextField({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="space-y-1.5">
      <span className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-orange-500/20 bg-[var(--surface-strong)] px-4 py-3 text-sm font-black text-[var(--headline)] outline-none transition-all focus:border-orange-500"
      />
    </label>
  )
}

function DateField({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="space-y-1.5">
      <span className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">{label}</span>
      <div className="relative">
        <CalendarDays className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-orange-500" size={16} />
        <input
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-2xl border border-orange-500/20 bg-[var(--surface-strong)] py-3 pl-11 pr-4 text-sm font-black text-[var(--headline)] outline-none transition-all focus:border-orange-500"
        />
      </div>
    </label>
  )
}
