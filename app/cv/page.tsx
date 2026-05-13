'use client'

import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BriefcaseBusiness, CalendarDays, FileBadge, Plus, Save, Ship, Trash2, UserRound } from 'lucide-react'
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
  charterer: string | null
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

type CrewCert = {
  id: string
  cert_name: string
  issue_date: string | null
  expiry_date: string | null
  file_url: string | null
}

type CvTab = 'form' | 'service' | 'vessels'
type ActiveUser = CurrentUser & { id: string }
const defaultCvCompany = 'Truth Maritime Services'

const emptyProfile: CvProfile = {
  national_id_no: '',
  nationality: '',
  date_of_birth: '',
  place_of_birth: '',
  cv_company: defaultCvCompany,
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
  charterer: 'PTTEP',
  joining_date: '',
  sign_off_date: '',
  remarks: '',
}

const emptyVessel: Omit<VesselMaster, 'id'> = {
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
}

const clean = (value: unknown) => String(value || '').trim()
const normalize = (value: unknown) => clean(value).toLowerCase().replace(/[^a-z0-9]/g, '')

const rankGroups = [
  {
    label: 'Barge crew',
    options: ['Barge Master', 'Chief Officer', 'Safety Officer', 'Radio Operator', 'Deck Foreman', 'AB', 'Rigger', 'Crane Operator'],
  },
  {
    label: 'Catering',
    options: ['Chief Cook', 'Cook', 'Steward', 'Messman'],
  },
  {
    label: 'Merchant ship',
    options: ['Master', 'Chief Mate', 'Second Mate', 'Chief Engineer', 'Second Engineer', 'Third Engineer', 'Oiler', 'Able Seaman', 'Ordinary Seaman'],
  },
]

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
  const [certRows, setCertRows] = useState<CrewCert[]>([])
  const [serviceForm, setServiceForm] = useState<SeaServiceForm>(emptySeaService)
  const [vesselForm, setVesselForm] = useState<Omit<VesselMaster, 'id'>>(emptyVessel)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingService, setSavingService] = useState(false)
  const [selectedVesselId, setSelectedVesselId] = useState('')
  const [activeTab, setActiveTab] = useState<CvTab>('form')

  useEffect(() => {
    const current = readCurrentUser()
    if (!current?.id) {
      router.replace('/login')
      return
    }
    const currentId = current.id
    const activeUser = current as ActiveUser
    setUser(activeUser)
    setProfile({
      national_id_no: clean((current as any).national_id_no),
      nationality: clean((current as any).nationality),
      date_of_birth: toDateValue((current as any).date_of_birth),
      place_of_birth: clean((current as any).place_of_birth),
      cv_company: clean((current as any).cv_company || defaultCvCompany),
    })
    setServiceForm((prev) => ({ ...prev, crew_id: currentId, rank: current.position || '' }))
    loadCv(activeUser)
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

  const linkedDocs = useMemo(() => {
    const findCert = (keywords: string[]) =>
      certRows.find((cert) => keywords.some((keyword) => normalize(cert.cert_name).includes(normalize(keyword))))

    return [
      { label: 'Passport', cert: findCert(['passport']) },
      { label: 'Seaman Book', cert: findCert(['seaman book', 'seamans book', 'seaman']) },
      { label: 'TOEIC', cert: findCert(['toeic']) },
      { label: 'Medical Fitness', cert: findCert(['medical']) },
    ]
  }, [certRows])

  async function loadCv(current: ActiveUser) {
    setLoading(true)
    setSqlMissing(false)
    const [vesselRes, serviceRes, certRes] = await Promise.all([
      supabase.from('cv_vessel_master').select('*').order('vessel_name', { ascending: true }),
      supabase
        .from('crew_cv_sea_services')
        .select('*')
        .eq('crew_id', current.id)
        .order('joining_date', { ascending: false, nullsFirst: false })
        .order('sign_off_date', { ascending: false, nullsFirst: false }),
      supabase
        .from('crew_certs')
        .select('id, cert_name, issue_date, expiry_date, file_url')
        .eq('crew_id', current.id),
    ])

    if (vesselRes.error || serviceRes.error) {
      setSqlMissing(true)
      setLoading(false)
      return
    }

    setVessels((vesselRes.data || []) as VesselMaster[])
    setServices((serviceRes.data || []) as SeaServiceRow[])
    if (!certRes.error) setCertRows((certRes.data || []) as CrewCert[])
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

  function editVesselShortcut(vessel: VesselMaster) {
    setVesselForm(stripVesselId(vessel))
    setActiveTab('vessels')
  }

  async function saveProfile() {
    if (!user?.id) return
    const crewId = user.id
    setSavingProfile(true)
    const payload = {
      national_id_no: profile.national_id_no || null,
      nationality: profile.nationality || null,
      date_of_birth: profile.date_of_birth || null,
      place_of_birth: profile.place_of_birth || null,
      cv_company: profile.cv_company || null,
      cv_last_updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('crews').update(payload).eq('id', crewId)
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

  async function saveVesselShortcut(source: Omit<VesselMaster, 'id'> = vesselForm) {
    if (!admin || !source.vessel_name) return
    const payload = buildVesselPayload(source, user)
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
    setVesselForm(stripVesselId(data as VesselMaster))
    toast.success('Vessel shortcut saved')
  }

  async function saveSeaService() {
    if (!user?.id) return
    const activeUser = user as ActiveUser
    if (!serviceForm.vessel_name || !serviceForm.rank || !serviceForm.joining_date || !serviceForm.sign_off_date) {
      toast.error('Please fill vessel, rank, joining date, and sign off date')
      return
    }
    setSavingService(true)
    const payload = {
      ...buildSeaServicePayload(serviceForm),
      crew_id: activeUser.id,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('crew_cv_sea_services').insert(payload)
    setSavingService(false)
    if (error) {
      toast.error(`${error.message}. Run sql/crew_cv_foundation.sql first.`)
      return
    }
    toast.success('Sea service added')
    setServiceForm({ ...emptySeaService, crew_id: activeUser.id, rank: activeUser.position || '' })
    setSelectedVesselId('')
    await loadCv(activeUser)
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

  async function deleteVesselShortcut(id: string) {
    if (!admin) return
    const { error } = await supabase.from('cv_vessel_master').delete().eq('id', id)
    if (error) {
      toast.error(error.message)
      return
    }
    setVessels((prev) => prev.filter((item) => item.id !== id))
    toast.success('Vessel shortcut deleted')
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

      <div className="mb-6 rounded-[32px] border border-orange-500/20 bg-[var(--surface)] p-2 shadow-xl">
        <div className={`grid gap-2 ${admin ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
          <TabButton active={activeTab === 'form'} label="CV Form" onClick={() => setActiveTab('form')} />
          <TabButton active={activeTab === 'service'} label="Sea Service" onClick={() => setActiveTab('service')} />
          {admin && <TabButton active={activeTab === 'vessels'} label="Vessel Data" onClick={() => setActiveTab('vessels')} />}
        </div>
      </div>

      {activeTab === 'form' && (
        <>
          <section className="rounded-[36px] border border-orange-500/20 bg-[var(--surface)] p-6 shadow-xl">
            <div className="mb-5 flex items-center gap-3">
              <BriefcaseBusiness className="text-orange-500" />
              <div>
                <h2 className="text-xl font-black italic uppercase text-[var(--headline)]">Person&apos;s Details</h2>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">Passport upload can prefill these fields, but you can edit manually.</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <FormLine label="Name" value={user?.full_name || '-'} />
              <FormLine label="Rank" value={user?.position || '-'} />
              <FormLine label="National ID No." editable={<TextField label="" value={profile.national_id_no} onChange={(value) => setProfile((prev) => ({ ...prev, national_id_no: value }))} />} />
              <FormLine label="Nationality" editable={<TextField label="" value={profile.nationality} onChange={(value) => setProfile((prev) => ({ ...prev, nationality: value }))} />} />
              <FormLine label="Date of Birth" editable={<DateField label="" value={profile.date_of_birth} onChange={(value) => setProfile((prev) => ({ ...prev, date_of_birth: value }))} />} />
              <FormLine label="Place of Birth" editable={<TextField label="" value={profile.place_of_birth} onChange={(value) => setProfile((prev) => ({ ...prev, place_of_birth: value }))} />} />
              <FormLine label="Safety Shoe" value={clean((user as any)?.boot_size) || '-'} />
              <FormLine label="Boiler Suit" value={`${clean((user as any)?.suit_color) || '-'} | ${clean((user as any)?.suit_size) || '-'}`} />
              <FormLine label="Company" editable={<TextField label="" value={profile.cv_company} onChange={(value) => setProfile((prev) => ({ ...prev, cv_company: value }))} />} />
            </div>
            <button onClick={saveProfile} disabled={savingProfile || sqlMissing} className="mt-5 rounded-2xl bg-orange-600 px-6 py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-orange-600/20 disabled:opacity-50">
              <Save size={15} className="mr-2 inline" /> {savingProfile ? 'Saving...' : 'Save CV Form Data'}
            </button>
          </section>

          <section className="mt-6 rounded-[36px] border border-orange-500/20 bg-[var(--surface)] p-6 shadow-xl">
            <div className="mb-5 flex items-center gap-3">
              <FileBadge className="text-orange-500" />
              <div>
                <h2 className="text-xl font-black italic uppercase text-[var(--headline)]">Linked Certificate Data</h2>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">Check what the CV can pull from personal certificates.</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {linkedDocs.map((item) => (
                <LinkedCertCard key={item.label} label={item.label} cert={item.cert} />
              ))}
            </div>
          </section>
        </>
      )}

      {activeTab === 'service' && (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <MetricCard label="Sea Service" value={serviceSummary.totalText} detail={`${serviceSummary.totalDays} total days`} />
            <MetricCard label="Vessels" value={String(serviceSummary.vesselCount)} detail="Unique vessel names" />
            <MetricCard label="Entries" value={String(services.length)} detail="Recorded service rows" />
          </section>

          <section className="mt-6 rounded-[36px] border border-orange-500/20 bg-[var(--surface)] p-6 shadow-xl">
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <Ship className="text-orange-500" />
                <div>
                  <h2 className="text-xl font-black italic uppercase text-[var(--headline)]">Sailing Voyages Entry</h2>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">CV-ready voyage data: select vessel, then fill rank, charter, and dates</p>
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
              <RankField label="Rank" value={serviceForm.rank || ''} onChange={(value) => setServiceForm((prev) => ({ ...prev, rank: value }))} />
              <SelectField label="Charter" value={serviceForm.charterer || 'PTTEP'} options={['PTTEP', 'Other']} onChange={(value) => setServiceForm((prev) => ({ ...prev, charterer: value }))} />
              <DateField label="Joining Date" value={serviceForm.joining_date || ''} onChange={(value) => setServiceForm((prev) => ({ ...prev, joining_date: value }))} />
              <DateField label="Sign Off Date" value={serviceForm.sign_off_date || ''} onChange={(value) => setServiceForm((prev) => ({ ...prev, sign_off_date: value }))} />
              <TextField label="Remarks" value={serviceForm.remarks || ''} onChange={(value) => setServiceForm((prev) => ({ ...prev, remarks: value }))} />
            </div>

            <button onClick={saveSeaService} disabled={savingService || sqlMissing} className="mt-5 rounded-2xl bg-orange-600 px-6 py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-orange-600/20 disabled:opacity-50">
              <Plus size={15} className="mr-2 inline" /> {savingService ? 'Saving...' : 'Add Sea Service'}
            </button>
          </section>

          <SeaServiceHistory services={services} onDelete={deleteSeaService} />
        </>
      )}

      {activeTab === 'vessels' && admin && (
        <>
          <section className="rounded-[36px] border border-orange-500/20 bg-[var(--surface)] p-6 shadow-xl">
            <div className="mb-5 flex items-center gap-3">
              <Ship className="text-orange-500" />
              <div>
                <h2 className="text-xl font-black italic uppercase text-[var(--headline)]">Vessel Data Master</h2>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">Admin shortcut database for sea service auto-fill</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <TextField label="Name of Vessel" value={vesselForm.vessel_name || ''} onChange={(value) => setVesselForm((prev) => ({ ...prev, vessel_name: value }))} />
              <TextField label="Vessel Type" value={vesselForm.vessel_type || ''} onChange={(value) => setVesselForm((prev) => ({ ...prev, vessel_type: value }))} />
              <TextField label="Flag" value={vesselForm.flag || ''} onChange={(value) => setVesselForm((prev) => ({ ...prev, flag: value }))} />
              <TextField label="IMO No." value={vesselForm.imo_no || ''} onChange={(value) => setVesselForm((prev) => ({ ...prev, imo_no: value }))} />
              <TextField label="GRT" value={vesselForm.grt || ''} onChange={(value) => setVesselForm((prev) => ({ ...prev, grt: value }))} />
              <TextField label="DWT" value={vesselForm.dwt || ''} onChange={(value) => setVesselForm((prev) => ({ ...prev, dwt: value }))} />
              <TextField label="Engine Type" value={vesselForm.engine_type || ''} onChange={(value) => setVesselForm((prev) => ({ ...prev, engine_type: value }))} />
              <TextField label="BHP" value={vesselForm.bhp || ''} onChange={(value) => setVesselForm((prev) => ({ ...prev, bhp: value }))} />
              <TextField label="Company" value={vesselForm.company || ''} onChange={(value) => setVesselForm((prev) => ({ ...prev, company: value }))} />
              <TextField label="Trading Area" value={vesselForm.trading_area || ''} onChange={(value) => setVesselForm((prev) => ({ ...prev, trading_area: value }))} />
            </div>
            <div className="mt-5 flex flex-col gap-3 md:flex-row">
              <button onClick={() => saveVesselShortcut(vesselForm)} disabled={!vesselForm.vessel_name || sqlMissing} className="rounded-2xl bg-orange-600 px-6 py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-orange-600/20 disabled:opacity-50">
                <Ship size={15} className="mr-2 inline" /> Save Vessel Data
              </button>
              <button onClick={() => setVesselForm(emptyVessel)} className="rounded-2xl border border-orange-500/30 bg-orange-500/10 px-6 py-4 text-xs font-black uppercase tracking-widest text-[var(--accent-text)]">
                Clear Form
              </button>
            </div>
          </section>

          <section className="mt-6 rounded-[36px] border border-orange-500/20 bg-[var(--surface)] p-6 shadow-xl">
            <h2 className="mb-5 text-xl font-black italic uppercase text-[var(--headline)]">Saved Vessel Data</h2>
            <div className="space-y-3">
              {vessels.length === 0 && <div className="rounded-3xl bg-[var(--surface-strong)] p-6 text-[var(--subtle)]">No vessel shortcuts yet.</div>}
              {vessels.map((vessel) => (
                <div key={vessel.id} className="grid gap-4 rounded-3xl border border-orange-500/15 bg-[var(--surface-strong)] p-5 md:grid-cols-[1.4fr_1fr_auto] md:items-center">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--accent-text)]">{vessel.vessel_type || 'Vessel'}</p>
                    <h3 className="mt-1 text-lg font-black italic uppercase text-[var(--headline)]">{vessel.vessel_name}</h3>
                    <p className="mt-1 text-xs normal-case text-[var(--subtle)]">{vessel.flag || '-'} | IMO {vessel.imo_no || '-'} | GRT {vessel.grt || '-'} | DWT {vessel.dwt || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">Engine / Area</p>
                    <p className="text-sm font-black text-[var(--headline)]">{vessel.engine_type || '-'} | {vessel.trading_area || '-'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => editVesselShortcut(vessel)} className="rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-xs font-black uppercase text-[var(--accent-text)]">Edit</button>
                    <button onClick={() => deleteVesselShortcut(vessel.id)} className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs font-black uppercase text-[var(--danger-text)]">
                      <Trash2 size={14} className="mr-2 inline" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </PageShell>
  )
}

function stripVesselId(vessel: VesselMaster): Omit<VesselMaster, 'id'> {
  return {
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
  }
}

function buildVesselPayload(form: Omit<VesselMaster, 'id'>, user: CurrentUser | null) {
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

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-[24px] px-5 py-4 text-xs font-black uppercase tracking-widest transition-all ${
        active ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-[var(--subtle)] hover:bg-orange-500/10 hover:text-[var(--headline)]'
      }`}
    >
      {label}
    </button>
  )
}

function FormLine({ editable, label, value }: { editable?: ReactNode; label: string; value?: string }) {
  return (
    <div className="grid gap-2 rounded-2xl border border-orange-500/15 bg-[var(--surface-strong)] p-4 md:grid-cols-[180px_1fr] md:items-center">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--accent-text)]">{label}</p>
      {editable || <p className="text-sm font-black normal-case text-[var(--headline)]">{value || '-'}</p>}
    </div>
  )
}

function LinkedCertCard({ cert, label }: { cert?: CrewCert; label: string }) {
  return (
    <div className={`rounded-3xl border p-5 ${cert ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-amber-500/20 bg-amber-500/10'}`}>
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">{label}</p>
      <h3 className="mt-2 text-base font-black italic uppercase text-[var(--headline)]">{cert?.cert_name || 'Not linked yet'}</h3>
      <p className="mt-2 text-xs normal-case text-[var(--subtle)]">
        Issued {formatDate(cert?.issue_date)} | Expiry {formatDate(cert?.expiry_date)}
      </p>
      {cert?.file_url && (
        <a href={cert.file_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--accent-text)]">
          View file
        </a>
      )}
    </div>
  )
}

function SeaServiceHistory({ onDelete, services }: { onDelete: (id: string) => void; services: SeaServiceRow[] }) {
  return (
    <section className="mt-6 rounded-[36px] border border-orange-500/20 bg-[var(--surface)] p-6 shadow-xl">
      <h2 className="mb-5 text-xl font-black italic uppercase text-[var(--headline)]">Sailing Voyages History</h2>
      <div className="space-y-3">
        {services.length === 0 && <div className="rounded-3xl bg-[var(--surface-strong)] p-6 text-[var(--subtle)]">No sea service records yet.</div>}
        {services.map((row) => {
          const days = dayDiffInclusive(row.joining_date, row.sign_off_date)
          return (
            <div key={row.id} className="grid gap-4 rounded-3xl border border-orange-500/15 bg-[var(--surface-strong)] p-5 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto] md:items-center">
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
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">Charter</p>
                <p className="text-sm font-black text-[var(--headline)]">{row.charterer || '-'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">Period</p>
                <p className="text-sm font-black text-[var(--headline)]">{formatDate(row.joining_date)} - {formatDate(row.sign_off_date)}</p>
                <p className="mt-1 text-[10px] font-black uppercase text-[var(--accent-text)]">{formatServiceDuration(days)}</p>
              </div>
              <button onClick={() => onDelete(row.id)} className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs font-black uppercase text-[var(--danger-text)]">
                <Trash2 size={14} className="mr-2 inline" /> Delete
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
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
    charterer: clean(form.charterer) || null,
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

function RankField({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="space-y-1.5">
      <span className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-orange-500/20 bg-[var(--surface-strong)] px-4 py-3 text-sm font-black text-[var(--headline)] outline-none transition-all focus:border-orange-500"
      >
        <option value="">Select rank...</option>
        {value && !rankGroups.some((group) => group.options.includes(value)) && (
          <option value={value}>{value}</option>
        ))}
        {rankGroups.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.options.map((rank) => (
              <option key={`${group.label}-${rank}`} value={rank}>{rank}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  )
}

function SelectField({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: string[]; value: string }) {
  return (
    <label className="space-y-1.5">
      <span className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-orange-500/20 bg-[var(--surface-strong)] px-4 py-3 text-sm font-black text-[var(--headline)] outline-none transition-all focus:border-orange-500"
      >
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
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
