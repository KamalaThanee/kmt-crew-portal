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
  cert_number?: string | null
  place_of_issue?: string | null
  issue_authority?: string | null
  cv_section?: string | null
  cv_row_no?: number | null
  cv_capacity?: string | null
  master_cert_family?: string | null
  master_cv_section?: string | null
  master_stcw_group_key?: string | null
  master_requires_proficiency?: boolean | null
  master_required_proficiency_key?: string | null
  master_cv_order?: number | null
}

type CvTrainingProficiencyPair = {
  training?: CrewCert
  proficiency?: CrewCert
  missingRequiredProficiency?: boolean
}

type CertMasterCvRule = {
  cert_name: string
  cert_family?: string | null
  cv_section?: string | null
  stcw_group_key?: string | null
  requires_proficiency?: boolean | null
  required_proficiency_key?: string | null
  cv_order?: number | null
}

type VaccinationRow = {
  id: string
  crew_id: string
  vaccine_name: string
  dose_detail: string | null
  date_given: string | null
  expiry_date: string | null
  place_given: string | null
  remarks: string | null
}

type CvTab = 'form' | 'service' | 'vessels'
type ActiveUser = CurrentUser & { id: string }
const defaultCvCompany = 'Truth Maritime Services'
const cvCertSections = ['Certificate of Competency', 'Certificate of Training', 'Certificate of Proficiency', 'Medical'] as const

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

const emptyVaccination: Omit<VaccinationRow, 'id'> = {
  crew_id: '',
  vaccine_name: '',
  dose_detail: '',
  date_given: '',
  expiry_date: '',
  place_given: '',
  remarks: '',
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
  const [vaccinations, setVaccinations] = useState<VaccinationRow[]>([])
  const [serviceForm, setServiceForm] = useState<SeaServiceForm>(emptySeaService)
  const [vesselForm, setVesselForm] = useState<Omit<VesselMaster, 'id'>>(emptyVessel)
  const [vaccinationForm, setVaccinationForm] = useState<Omit<VaccinationRow, 'id'>>(emptyVaccination)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingService, setSavingService] = useState(false)
  const [savingCertId, setSavingCertId] = useState('')
  const [savingVaccination, setSavingVaccination] = useState(false)
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
    setVaccinationForm((prev) => ({ ...prev, crew_id: currentId }))
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

  const personalDocs = useMemo(() => buildPersonalDocs(certRows), [certRows])
  const cvCertTables = useMemo(() => buildCvCertTables(certRows), [certRows])

  async function loadCv(current: ActiveUser) {
    setLoading(true)
    setSqlMissing(false)
    const [vesselRes, serviceRes, certRes, certMasterRes, vaccinationRes] = await Promise.all([
      supabase.from('cv_vessel_master').select('*').order('vessel_name', { ascending: true }),
      supabase
        .from('crew_cv_sea_services')
        .select('*')
        .eq('crew_id', current.id)
        .order('joining_date', { ascending: false, nullsFirst: false })
        .order('sign_off_date', { ascending: false, nullsFirst: false }),
      supabase
        .from('crew_certs')
        .select('id, cert_name, issue_date, expiry_date, file_url, cert_number, place_of_issue, issue_authority, cv_section, cv_row_no, cv_capacity')
        .eq('crew_id', current.id),
      supabase
        .from('cert_master')
        .select('cert_name, cert_family, cv_section, stcw_group_key, requires_proficiency, required_proficiency_key, cv_order'),
      supabase
        .from('crew_cv_vaccinations')
        .select('*')
        .eq('crew_id', current.id)
        .order('date_given', { ascending: false, nullsFirst: false }),
    ])

    if (vesselRes.error || serviceRes.error || vaccinationRes.error) {
      setSqlMissing(true)
      setLoading(false)
      return
    }

    setVessels((vesselRes.data || []) as VesselMaster[])
    setServices((serviceRes.data || []) as SeaServiceRow[])
    if (!certRes.error) setCertRows(attachCertMasterRules((certRes.data || []) as CrewCert[], (certMasterRes.data || []) as CertMasterCvRule[]))
    setVaccinations((vaccinationRes.data || []) as VaccinationRow[])
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

  async function saveCertCvDetails(cert: CrewCert) {
    setSavingCertId(cert.id)
    const payload = {
      cert_number: cert.cert_number || null,
      place_of_issue: cert.place_of_issue || null,
      issue_authority: cert.issue_authority || null,
      cv_section: getCvCertSection(cert),
      cv_row_no: cert.cv_row_no || null,
      cv_capacity: cert.cv_capacity || null,
      issue_date: cert.issue_date || null,
      expiry_date: cert.expiry_date || null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('crew_certs').update(payload).eq('id', cert.id)
    setSavingCertId('')
    if (error) {
      toast.error(`${error.message}. Run sql/crew_cv_foundation.sql first.`)
      return
    }
    toast.success('CV certificate detail saved')
  }

  async function saveVaccination() {
    if (!user?.id) return
    const activeUser = user as ActiveUser
    if (!vaccinationForm.vaccine_name) {
      toast.error('Please fill vaccination name')
      return
    }
    setSavingVaccination(true)
    const payload = {
      crew_id: activeUser.id,
      vaccine_name: clean(vaccinationForm.vaccine_name),
      dose_detail: clean(vaccinationForm.dose_detail) || null,
      date_given: vaccinationForm.date_given || null,
      expiry_date: vaccinationForm.expiry_date || null,
      place_given: clean(vaccinationForm.place_given) || null,
      remarks: clean(vaccinationForm.remarks) || null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('crew_cv_vaccinations').insert(payload)
    setSavingVaccination(false)
    if (error) {
      toast.error(`${error.message}. Run sql/crew_cv_foundation.sql first.`)
      return
    }
    toast.success('Vaccination detail added')
    setVaccinationForm({ ...emptyVaccination, crew_id: activeUser.id })
    await loadCv(activeUser)
  }

  async function deleteVaccination(id: string) {
    const { error } = await supabase.from('crew_cv_vaccinations').delete().eq('id', id)
    if (error) {
      toast.error(error.message)
      return
    }
    setVaccinations((prev) => prev.filter((item) => item.id !== id))
    toast.success('Vaccination detail deleted')
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
              <FormLine label="Passport" value={formatPersonalDoc(personalDocs.passport)} />
              <FormLine label="Seaman Book" value={formatPersonalDoc(personalDocs.seamanBook)} />
              <FormLine label="TOEIC" value={formatPersonalDoc(personalDocs.toeic)} />
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
                <h2 className="text-xl font-black italic uppercase text-[var(--headline)]">Certificates and Training</h2>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">CV form layout: competency, training/proficiency pairs, medical fitness, and vaccination details.</p>
              </div>
            </div>
            <CvCertificateTables
              tables={cvCertTables}
              savingCertId={savingCertId}
              onChange={(nextCert) => setCertRows((prev) => prev.map((item) => item.id === nextCert.id ? nextCert : item))}
              onSave={(certId) => {
                const currentCert = certRows.find((item) => item.id === certId)
                if (currentCert) saveCertCvDetails(currentCert)
              }}
            />
          </section>

          <section className="mt-6 rounded-[36px] border border-orange-500/20 bg-[var(--surface)] p-6 shadow-xl">
            <div className="mb-5 flex items-center gap-3">
              <FileBadge className="text-orange-500" />
              <div>
                <h2 className="text-xl font-black italic uppercase text-[var(--headline)]">Vaccination Details</h2>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">Manual CV fields for vaccine, dose, date, place, and remarks.</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
              <TextField label="Vaccine" value={vaccinationForm.vaccine_name} onChange={(value) => setVaccinationForm((prev) => ({ ...prev, vaccine_name: value }))} />
              <TextField label="Dose / Detail" value={vaccinationForm.dose_detail || ''} onChange={(value) => setVaccinationForm((prev) => ({ ...prev, dose_detail: value }))} />
              <DateField label="Date Given" value={vaccinationForm.date_given || ''} onChange={(value) => setVaccinationForm((prev) => ({ ...prev, date_given: value }))} />
              <DateField label="Expiry Date" value={vaccinationForm.expiry_date || ''} onChange={(value) => setVaccinationForm((prev) => ({ ...prev, expiry_date: value }))} />
              <TextField label="Place" value={vaccinationForm.place_given || ''} onChange={(value) => setVaccinationForm((prev) => ({ ...prev, place_given: value }))} />
              <TextField label="Remarks" value={vaccinationForm.remarks || ''} onChange={(value) => setVaccinationForm((prev) => ({ ...prev, remarks: value }))} />
            </div>
            <button onClick={saveVaccination} disabled={savingVaccination || sqlMissing} className="mt-5 rounded-2xl bg-orange-600 px-6 py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-orange-600/20 disabled:opacity-50">
              <Plus size={15} className="mr-2 inline" /> {savingVaccination ? 'Saving...' : 'Add Vaccination'}
            </button>
            <VaccinationTable rows={vaccinations} onDelete={deleteVaccination} />
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

function findCertByKeywords(rows: CrewCert[], keywords: string[]) {
  return rows.find((cert) => keywords.some((keyword) => normalize(cert.cert_name).includes(normalize(keyword))))
}

function attachCertMasterRules(rows: CrewCert[], masterRows: CertMasterCvRule[]) {
  const exact = new Map(masterRows.map((row) => [normalize(row.cert_name), row]))
  return rows.map((cert) => {
    const certKey = normalize(cert.cert_name)
    const master =
      exact.get(certKey) ||
      masterRows.find((row) => {
        const masterKey = normalize(row.cert_name)
        return masterKey && (masterKey.includes(certKey) || certKey.includes(masterKey))
      })

    if (!master) return cert
    return {
      ...cert,
      master_cert_family: master.cert_family || null,
      master_cv_section: master.cv_section || null,
      master_stcw_group_key: master.stcw_group_key || null,
      master_requires_proficiency: master.requires_proficiency ?? null,
      master_required_proficiency_key: master.required_proficiency_key || null,
      master_cv_order: master.cv_order ?? null,
    }
  })
}

function buildPersonalDocs(rows: CrewCert[]) {
  return {
    passport: findCertByKeywords(rows, ['passport']),
    seamanBook: findCertByKeywords(rows, ['seaman book', 'seamans book', 'seaman book', 'seaman']),
    toeic: findCertByKeywords(rows, ['toeic']),
  }
}

function formatPersonalDoc(cert?: CrewCert) {
  if (!cert) return '-'
  const number = clean(cert.cert_number) || clean(cert.cert_name)
  const issued = cert.issue_date ? `Issued ${formatDate(cert.issue_date)}` : 'Issued -'
  const expiry = cert.expiry_date ? `Exp ${formatDate(cert.expiry_date)}` : 'Exp -'
  return `${number} | ${issued} | ${expiry}`
}

function isPersonalDocument(cert: CrewCert) {
  if (clean(cert.master_cv_section) === 'Personal Document') return true
  if (clean(cert.master_cert_family) === 'Personal Document') return true
  const name = normalize(cert.cert_name)
  return name.includes('passport') || name.includes('seaman') || name.includes('toeic')
}

function getCvCertSection(cert: CrewCert) {
  const masterSection = clean(cert.master_cv_section)
  if (masterSection) return masterSection
  const explicit = clean(cert.cv_section)
  if (explicit) return explicit
  const name = normalize(cert.cert_name)
  if (name.includes('medical') || name.includes('fitness')) return 'Medical'
  if (name.includes('competency') || name.includes('coc') || name.includes('certificateofcompetency') || name.includes('license') || name.includes('licence')) return 'Certificate of Competency'
  if (name.includes('proficiency') || name.includes('cop') || name.includes('gmdss') || name.includes('endorsement')) return 'Certificate of Proficiency'
  return 'Certificate of Training'
}

function getStcwPriority(cert: CrewCert) {
  if (typeof cert.master_cv_order === 'number') return cert.master_cv_order
  const name = normalize(cert.cert_name)
  const stcwOrder = [
    ['personal survival techniques', 'personalsurvivaltechniques', 'pst'],
    ['fire prevention and fire fighting', 'firepreventionandfirefighting', 'fpff'],
    ['elementary first aid', 'elementaryfirstaid', 'efa'],
    ['personal safety and social responsibility', 'personalsafetyandsocialresponsibility', 'pssr'],
    ['basic safety training', 'basicsafetytraining', 'basictraining'],
    ['security awareness', 'securityawareness'],
    ['designated security duties', 'designatedsecurityduties', 'dsd'],
    ['proficiency in survival craft', 'survivalcraft', 'rescueboat', 'pscrb'],
    ['advanced fire fighting', 'advancefirefighting', 'advancedfirefighting', 'aff'],
    ['medical first aid', 'medicalfirstaid'],
    ['medical care', 'medicalcare'],
    ['gmdss', 'generaloperator', 'radiooperator'],
    ['dangerous goods', 'dangerousgoods', 'hazmat', 'chemical'],
    ['bosiet', 'foet', 'basicoffshoresafety'],
  ]
  const index = stcwOrder.findIndex((keywords) => keywords.some((keyword) => name.includes(normalize(keyword))))
  if (index >= 0) return index + 1
  if (name.includes('stcw')) return 50
  return 1000
}

function getStcwGroup(cert: CrewCert) {
  const masterGroup = clean(cert.master_stcw_group_key)
  if (masterGroup) return masterGroup
  const name = normalize(cert.cert_name)
  if (name.includes('basicsafety') || name.includes('basictraining') || name.includes('personalsurvival') || name.includes('fireprevention') || name.includes('elementaryfirstaid') || name.includes('personalsafety') || name.includes('pssr')) return 'basic_safety'
  if (name.includes('survivalcraft') || name.includes('rescueboat') || name.includes('pscrb')) return 'survival_craft'
  if (name.includes('advancefire') || name.includes('advancedfire')) return 'advanced_fire'
  if (name.includes('medicalfirstaid')) return 'medical_first_aid'
  if (name.includes('medicalcare')) return 'medical_care'
  if (name.includes('gmdss') || name.includes('radiooperator')) return 'gmdss'
  if (name.includes('securityawareness') || name.includes('designatedsecurity') || name.includes('shipsecurity')) return 'security'
  if (name.includes('dangerousgoods') || name.includes('hazmat') || name.includes('chemical')) return 'dangerous_goods'
  return 'other'
}

function requiresProficiency(cert: CrewCert) {
  if (cert.master_requires_proficiency === true) return true
  return Boolean(clean(cert.master_required_proficiency_key))
}

function sortCvCerts(rows: CrewCert[]) {
  return [...rows].sort((a, b) => {
    const rowA = Number(a.cv_row_no || 9999)
    const rowB = Number(b.cv_row_no || 9999)
    if (rowA !== rowB) return rowA - rowB
    const stcwA = getStcwPriority(a)
    const stcwB = getStcwPriority(b)
    if (stcwA !== stcwB) return stcwA - stcwB
    return String(a.cert_name || '').localeCompare(String(b.cert_name || ''))
  })
}

function buildCvCertTables(rows: CrewCert[]) {
  const cvRows = rows.filter((cert) => !isPersonalDocument(cert))
  const competency = sortCvCerts(cvRows.filter((cert) => getCvCertSection(cert) === 'Certificate of Competency'))
  const training = sortCvCerts(cvRows.filter((cert) => getCvCertSection(cert) === 'Certificate of Training'))
  const proficiency = sortCvCerts(cvRows.filter((cert) => getCvCertSection(cert) === 'Certificate of Proficiency'))
  const medical = sortCvCerts(cvRows.filter((cert) => getCvCertSection(cert) === 'Medical'))
  const remainingProficiency = [...proficiency]
  const paired: CvTrainingProficiencyPair[] = training.map((trainingCert) => {
    const explicitIndex = remainingProficiency.findIndex((cert) => cert.cv_row_no && cert.cv_row_no === trainingCert.cv_row_no)
    const requiredKey = clean(trainingCert.master_required_proficiency_key)
    const group = requiredKey || getStcwGroup(trainingCert)
    const groupIndex = group === 'other' ? -1 : remainingProficiency.findIndex((cert) => getStcwGroup(cert) === group)
    const index = explicitIndex >= 0 ? explicitIndex : groupIndex
    const matched = index >= 0 ? remainingProficiency.splice(index, 1)[0] : undefined
    return { training: trainingCert, proficiency: matched, missingRequiredProficiency: requiresProficiency(trainingCert) && !matched }
  })
  remainingProficiency.forEach((cert) => paired.push({ training: undefined, proficiency: cert }))
  return { competency, training, proficiency, paired, medical }
}

function CvCertificateTables({
  onChange,
  onSave,
  savingCertId,
  tables,
}: {
  tables: ReturnType<typeof buildCvCertTables>
  savingCertId: string
  onChange: (cert: CrewCert) => void
  onSave: (certId: string) => void
}) {
  const hasAnyCert = tables.competency.length || tables.paired.length || tables.medical.length
  if (!hasAnyCert) return <div className="rounded-3xl bg-[var(--surface-strong)] p-6 text-[var(--subtle)]">No uploaded certificates found for this crew yet.</div>

  return (
    <div className="space-y-6">
      <CvSimpleCertTable
        title="Certificate of Competency"
        rows={tables.competency}
        section="Certificate of Competency"
        savingCertId={savingCertId}
        onChange={onChange}
        onSave={onSave}
        competency
      />

      <div>
        <CvTableTitle title="Certificates of Training and Certificate of Proficiency" subtitle="Training certificates can sit on the same row as the related STCW proficiency certificate." />
        <div className="space-y-3 md:hidden">
          {tables.paired.map((row, index) => (
            <CvPairMobileCard
              key={`${row.training?.id || 'training'}-${row.proficiency?.id || 'proficiency'}-${index}-mobile`}
              row={row}
              savingCertId={savingCertId}
              onChange={onChange}
              onSave={onSave}
            />
          ))}
        </div>
        <div className="hidden overflow-x-auto rounded-3xl border border-orange-500/20 md:block">
          <table className="min-w-[1080px] w-full text-left text-xs">
            <thead className="bg-orange-500/10 text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">
              <tr>
                <th className="px-4 py-3">Training Certificate</th>
                <th className="px-4 py-3">Number</th>
                <th className="px-4 py-3">Issued Date</th>
                <th className="px-4 py-3">Expiry Date</th>
                <th className="px-4 py-3">Place of Issue</th>
                <th className="px-4 py-3">Proficiency Certificate</th>
                <th className="px-4 py-3">Number</th>
                <th className="px-4 py-3">Issued Date</th>
                <th className="px-4 py-3">Expiry Date</th>
                <th className="px-4 py-3">Issue Authority</th>
              </tr>
            </thead>
            <tbody>
              {tables.paired.map((row, index) => (
                <tr key={`${row.training?.id || 'training'}-${row.proficiency?.id || 'proficiency'}-${index}`} className="border-t border-orange-500/10 align-top">
                  <CvTrainingPairCells cert={row.training} section="Certificate of Training" saving={row.training ? savingCertId === row.training.id : false} missingRequiredProficiency={row.missingRequiredProficiency} onChange={onChange} onSave={onSave} />
                  <CvTrainingPairCells cert={row.proficiency} section="Certificate of Proficiency" saving={row.proficiency ? savingCertId === row.proficiency.id : false} onChange={onChange} onSave={onSave} proficiency />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <CvSimpleCertTable
        title="Medical Fitness Certificates / Details"
        rows={tables.medical}
        section="Medical"
        savingCertId={savingCertId}
        onChange={onChange}
        onSave={onSave}
        medical
      />
    </div>
  )
}

function CvTableTitle({ subtitle, title }: { subtitle?: string; title: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-black uppercase tracking-widest text-[var(--accent-text)]">{title}</h3>
      {subtitle && <p className="mt-1 text-xs normal-case text-[var(--subtle)]">{subtitle}</p>}
    </div>
  )
}

function CvSimpleCertTable({
  medical,
  competency,
  onChange,
  onSave,
  rows,
  savingCertId,
  section,
  title,
}: {
  title: string
  section: string
  rows: CrewCert[]
  savingCertId: string
  onChange: (cert: CrewCert) => void
  onSave: (certId: string) => void
  medical?: boolean
  competency?: boolean
}) {
  if (rows.length === 0) {
    return (
      <div>
        <CvTableTitle title={title} />
        <div className="rounded-3xl bg-[var(--surface-strong)] p-5 text-xs font-black uppercase tracking-widest text-[var(--subtle)]">No records yet</div>
      </div>
    )
  }

  return (
    <div>
      <CvTableTitle title={title} />
      <div className="overflow-x-auto rounded-3xl border border-orange-500/20">
        <div className="space-y-3 p-3 md:hidden">
          {rows.map((cert) => (
            <CvCertMobileCard
              key={`${cert.id}-mobile`}
              cert={cert}
              section={section}
              saving={savingCertId === cert.id}
              onChange={onChange}
              onSave={() => onSave(cert.id)}
              medical={medical}
              competency={competency}
            />
          ))}
        </div>
        <table className="hidden min-w-[920px] w-full text-left text-xs md:table">
          <thead className="bg-orange-500/10 text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">
            <tr>
              <th className="px-4 py-3">{medical ? 'Medical Check Up Program' : 'Certificate'}</th>
              <th className="px-4 py-3">{competency ? 'Capacity' : medical ? 'Name of Hospital' : 'Number'}</th>
              <th className="px-4 py-3">Issued Date</th>
              <th className="px-4 py-3">Expiry Date</th>
              <th className="px-4 py-3">{competency ? 'Certificate No.' : medical ? 'Certificate No.' : 'Place / Authority'}</th>
              {competency && <th className="px-4 py-3">Issue Authority</th>}
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((cert) => (
              <tr key={cert.id} className="border-t border-orange-500/10 align-top">
                <td className="px-4 py-3">
                  <EditableCertName cert={cert} section={section} onChange={onChange} />
                </td>
                <td className="px-4 py-3">
                  <TextField label="" value={competency ? cert.cv_capacity || '' : medical ? cert.place_of_issue || '' : cert.cert_number || ''} onChange={(value) => onChange(competency ? { ...cert, cv_capacity: value, cv_section: section } : medical ? { ...cert, place_of_issue: value, cv_section: section } : { ...cert, cert_number: value, cv_section: section })} />
                </td>
                <td className="px-4 py-3"><DateField label="" value={toDateValue(cert.issue_date)} onChange={(value) => onChange({ ...cert, issue_date: value, cv_section: section })} /></td>
                <td className="px-4 py-3"><DateField label="" value={toDateValue(cert.expiry_date)} onChange={(value) => onChange({ ...cert, expiry_date: value, cv_section: section })} /></td>
                <td className="px-4 py-3">
                  <TextField label="" value={competency ? cert.cert_number || '' : medical ? cert.cert_number || '' : cert.place_of_issue || cert.issue_authority || ''} onChange={(value) => onChange(competency ? { ...cert, cert_number: value, cv_section: section } : medical ? { ...cert, cert_number: value, cv_section: section } : { ...cert, place_of_issue: value, cv_section: section })} />
                </td>
                {competency && (
                  <td className="px-4 py-3">
                    <TextField label="" value={cert.issue_authority || ''} onChange={(value) => onChange({ ...cert, issue_authority: value, cv_section: section })} />
                  </td>
                )}
                <td className="px-4 py-3">
                  <CertActions cert={cert} saving={savingCertId === cert.id} onSave={() => onSave(cert.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CvTrainingPairCells({
  cert,
  missingRequiredProficiency,
  onChange,
  onSave,
  proficiency,
  saving,
  section,
}: {
  cert?: CrewCert
  section: string
  saving: boolean
  missingRequiredProficiency?: boolean
  proficiency?: boolean
  onChange: (cert: CrewCert) => void
  onSave: (certId: string) => void
}) {
  if (!cert) return <td className="px-4 py-3 text-[var(--subtle)]" colSpan={5}>-</td>
  return (
    <>
      <td className="px-4 py-3"><EditableCertName cert={cert} section={section} onChange={onChange} /></td>
      <td className="px-4 py-3"><TextField label="" value={cert.cert_number || ''} onChange={(value) => onChange({ ...cert, cert_number: value, cv_section: section })} /></td>
      <td className="px-4 py-3"><DateField label="" value={toDateValue(cert.issue_date)} onChange={(value) => onChange({ ...cert, issue_date: value, cv_section: section })} /></td>
      <td className="px-4 py-3"><DateField label="" value={toDateValue(cert.expiry_date)} onChange={(value) => onChange({ ...cert, expiry_date: value, cv_section: section })} /></td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-2">
          <TextField label="" value={proficiency ? cert.issue_authority || '' : cert.place_of_issue || ''} onChange={(value) => onChange(proficiency ? { ...cert, issue_authority: value, cv_section: section } : { ...cert, place_of_issue: value, cv_section: section })} />
          {missingRequiredProficiency && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-red-400">COP required</p>}
          <CertActions cert={cert} saving={saving} onSave={() => onSave(cert.id)} />
        </div>
      </td>
    </>
  )
}

function CvPairMobileCard({
  onChange,
  onSave,
  row,
  savingCertId,
}: {
  row: CvTrainingProficiencyPair
  savingCertId: string
  onChange: (cert: CrewCert) => void
  onSave: (certId: string) => void
}) {
  const training = row.training
  const proficiency = row.proficiency
  return (
    <div className="rounded-3xl border border-orange-500/20 bg-[var(--surface-strong)] p-4">
      <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-[var(--accent-text)]">Training / Proficiency Pair</p>
      <div className="space-y-4">
        {training ? (
          <CvCertMobileCard cert={training} section="Certificate of Training" saving={savingCertId === training.id} onChange={onChange} onSave={() => onSave(training.id)} compactTitle="Certificate of Training" warning={row.missingRequiredProficiency ? 'COP required for this training certificate' : ''} />
        ) : (
          <div className="rounded-2xl bg-[var(--surface)] p-4 text-xs font-black uppercase tracking-widest text-[var(--subtle)]">No training certificate in this row</div>
        )}
        {proficiency ? (
          <CvCertMobileCard cert={proficiency} section="Certificate of Proficiency" saving={savingCertId === proficiency.id} onChange={onChange} onSave={() => onSave(proficiency.id)} compactTitle="Certificate of Proficiency" />
        ) : (
          <div className="rounded-2xl bg-[var(--surface)] p-4 text-xs font-black uppercase tracking-widest text-[var(--subtle)]">No proficiency certificate in this row</div>
        )}
      </div>
    </div>
  )
}

function CvCertMobileCard({
  cert,
  compactTitle,
  competency,
  medical,
  onChange,
  onSave,
  saving,
  section,
  warning,
}: {
  cert: CrewCert
  section: string
  saving: boolean
  competency?: boolean
  medical?: boolean
  compactTitle?: string
  warning?: string
  onChange: (cert: CrewCert) => void
  onSave: () => void
}) {
  return (
    <div className="rounded-2xl border border-orange-500/15 bg-[var(--surface)] p-4">
      {compactTitle && <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">{compactTitle}</p>}
      <EditableCertName cert={cert} section={section} onChange={onChange} />
      {warning && <p className="mt-2 rounded-xl bg-red-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-red-400">{warning}</p>}
      <div className="mt-3 grid gap-3">
        <TextField label={competency ? 'Capacity' : medical ? 'Name of Hospital' : 'Number'} value={competency ? cert.cv_capacity || '' : medical ? cert.place_of_issue || '' : cert.cert_number || ''} onChange={(value) => onChange(competency ? { ...cert, cv_capacity: value, cv_section: section } : medical ? { ...cert, place_of_issue: value, cv_section: section } : { ...cert, cert_number: value, cv_section: section })} />
        <DateField label="Issued Date" value={toDateValue(cert.issue_date)} onChange={(value) => onChange({ ...cert, issue_date: value, cv_section: section })} />
        <DateField label="Expiry Date" value={toDateValue(cert.expiry_date)} onChange={(value) => onChange({ ...cert, expiry_date: value, cv_section: section })} />
        <TextField label={competency ? 'Certificate No.' : medical ? 'Certificate No.' : 'Place / Authority'} value={competency ? cert.cert_number || '' : medical ? cert.cert_number || '' : cert.place_of_issue || cert.issue_authority || ''} onChange={(value) => onChange(competency ? { ...cert, cert_number: value, cv_section: section } : medical ? { ...cert, cert_number: value, cv_section: section } : { ...cert, place_of_issue: value, cv_section: section })} />
        {competency && <TextField label="Issue Authority" value={cert.issue_authority || ''} onChange={(value) => onChange({ ...cert, issue_authority: value, cv_section: section })} />}
      </div>
      <div className="mt-3">
        <CertActions cert={cert} saving={saving} onSave={onSave} />
      </div>
    </div>
  )
}

function EditableCertName({ cert, onChange, section }: { cert: CrewCert; section: string; onChange: (cert: CrewCert) => void }) {
  return (
    <div className="min-w-[190px]">
      <p className="mb-2 text-sm font-black italic uppercase text-[var(--headline)]">{cert.cert_name}</p>
      <div className="grid grid-cols-[80px_1fr] gap-2">
        <TextField label="" value={cert.cv_row_no ? String(cert.cv_row_no) : ''} onChange={(value) => onChange({ ...cert, cv_row_no: value ? Number(value) : null, cv_section: section })} />
        <SelectField label="" value={getCvCertSection(cert)} options={[...cvCertSections]} onChange={(value) => onChange({ ...cert, cv_section: value })} />
      </div>
    </div>
  )
}

function CertActions({ cert, onSave, saving }: { cert: CrewCert; onSave: () => void; saving: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {cert.file_url && (
        <a href={cert.file_url} target="_blank" rel="noreferrer" className="rounded-2xl border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--accent-text)]">
          File
        </a>
      )}
      <button onClick={onSave} disabled={saving} className="rounded-2xl bg-orange-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-orange-600/20 disabled:opacity-50">
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  )
}

function VaccinationTable({ onDelete, rows }: { rows: VaccinationRow[]; onDelete: (id: string) => void }) {
  if (rows.length === 0) return <div className="mt-5 rounded-3xl bg-[var(--surface-strong)] p-5 text-xs font-black uppercase tracking-widest text-[var(--subtle)]">No vaccination records yet</div>
  return (
    <div className="mt-5 overflow-x-auto rounded-3xl border border-orange-500/20">
      <table className="min-w-[880px] w-full text-left text-xs">
        <thead className="bg-orange-500/10 text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">
          <tr>
            <th className="px-4 py-3">Vaccine</th>
            <th className="px-4 py-3">Dose / Detail</th>
            <th className="px-4 py-3">Date Given</th>
            <th className="px-4 py-3">Expiry Date</th>
            <th className="px-4 py-3">Place</th>
            <th className="px-4 py-3">Remarks</th>
            <th className="px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-orange-500/10">
              <td className="px-4 py-3 font-black text-[var(--headline)]">{row.vaccine_name}</td>
              <td className="px-4 py-3 text-[var(--headline)]">{row.dose_detail || '-'}</td>
              <td className="px-4 py-3 text-[var(--headline)]">{formatDate(row.date_given)}</td>
              <td className="px-4 py-3 text-[var(--headline)]">{formatDate(row.expiry_date)}</td>
              <td className="px-4 py-3 text-[var(--headline)]">{row.place_given || '-'}</td>
              <td className="px-4 py-3 text-[var(--subtle)]">{row.remarks || '-'}</td>
              <td className="px-4 py-3">
                <button onClick={() => onDelete(row.id)} className="rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--danger-text)]">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
        )}
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
