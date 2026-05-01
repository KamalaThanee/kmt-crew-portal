'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CalendarClock, ExternalLink, FileBadge, Loader2, PlusCircle, Search, ShipWheel, UploadCloud, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { compressImage } from '@/lib/certificateUpload'
import { canViewShipCertificates, isAdminRole } from '@/lib/roles'
import { readCurrentUser, type CurrentUser } from '@/lib/currentUser'
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
const editableCategories = categories.filter((category) => category !== 'all')
const statusFilters: Array<'all' | ShipCertificateStatus> = ['all', 'expired', 'due-30', 'due-60', 'due-90', 'due-180', 'valid', 'no-expiry']
const SHIP_CERT_BUCKET = 'ship-certificates'
type DashboardFilter = 'all' | 'expired' | 'due30' | 'due90' | 'surveyDue'

const categoryCodePrefixes: Record<string, string> = {
  Flag: 'F',
  Class: 'C',
  Insurance: 'I',
  Permit: 'P',
  GMDSS: 'G',
  FFE: 'FE',
  LSA: 'L',
}

const shipCertificateAiModels = [
  { id: 'gemini-2.5-flash', provider: 'google', label: 'Gemini 2.5 Flash (AI Studio)' },
  { id: 'gemini-3-flash-preview', provider: 'google', label: 'Gemini 3 Flash Preview (AI Studio)' },
  { id: 'gemini-3.1-flash-lite-preview', provider: 'google', label: 'Gemini 3.1 Flash Lite Preview (AI Studio)' },
  { id: 'qwen/qwen3-vl-32b-instruct', provider: 'openrouter', label: 'Qwen3 VL 32B Instruct (OpenRouter)' },
  { id: 'google/gemini-2.5-flash-lite', provider: 'openrouter', label: 'Gemini 2.5 Flash Lite (OpenRouter)' },
]

type ShipCertificateForm = {
  category: string
  code: string
  cert_name: string
  issue_by: string
  issued_date: string
  expiry_date: string
  last_survey_date: string
  next_survey_date: string
  remark: string
  has_expiry: boolean
  has_survey: boolean
}

type ShipCertScanResult = {
  issueBy?: string
  issuedDate?: string
  expiryDate?: string
  lastSurveyDate?: string
  nextSurveyDate?: string
  detectedCertName?: string
  certificateNumber?: string
  certTypeMatch?: boolean
  note?: string
  analysisMode?: 'text' | 'vision'
  activeModel?: string
}

const sanitizeFilePart = (value?: string | null, fallback = 'ship-cert') => {
  const clean = String(value || fallback)
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80)
  return clean || fallback
}

const buildShipCertFilePath = (certificate: ShipCertificate, file: File, form: ShipCertificateForm) => {
  const ext = (file.name.split('.').pop() || 'pdf').toLowerCase()
  const vessel = sanitizeFilePart(certificate.vessel_name, 'Kamala_Thanee')
  const category = sanitizeFilePart(form.category || certificate.category, 'Ship_Certificate')
  const certCode = sanitizeFilePart(form.code || certificate.code, 'NO_CODE')
  const certName = sanitizeFilePart(form.cert_name || certificate.cert_name, 'Certificate')
  const expiryDate = sanitizeFilePart(form.expiry_date || 'NO_EXPIRY', 'NO_EXPIRY')

  return `${vessel}/${category}/${certCode}_${certName}_${expiryDate}.${ext}`
}

const cleanCertificateRemark = (value?: string | null) => {
  const seen = new Set<string>()
  return String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^cert\s*no\.?\s*:\s*/i, '').trim())
    .filter((line) => !/^ai\s*:/i.test(line))
    .filter((line) => {
      const key = line.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .join('\n')
}

const buildFormFromCert = (row: ShipCertificate): ShipCertificateForm => ({
  category: row.category || 'Flag',
  code: row.code || '',
  cert_name: row.cert_name || '',
  issue_by: row.issue_by || '',
  issued_date: row.issued_date || '',
  expiry_date: row.expiry_date || '',
  last_survey_date: row.last_survey_date || '',
  next_survey_date: row.next_survey_date || '',
  remark: cleanCertificateRemark(row.remark),
  has_expiry: row.has_expiry !== false,
  has_survey: row.has_survey === true,
})

const buildBlankShipCert = (sortOrder: number, category = 'Flag'): ShipCertificate => ({
  vessel_name: 'Kamala Thanee',
  category,
  code: '',
  cert_name: '',
  issue_by: '',
  has_expiry: true,
  has_survey: false,
  sort_order: sortOrder,
})

const getNextCertCode = (rows: ShipCertificate[], category: string) => {
  const prefix = categoryCodePrefixes[category] || category.slice(0, 1).toUpperCase()
  const numbers = rows
    .filter((row) => row.category === category)
    .map((row) => String(row.code || '').trim().toUpperCase())
    .map((code) => {
      const match = code.match(new RegExp(`^${prefix}(\\d+)$`, 'i'))
      return match ? Number(match[1]) : 0
    })
  return `${prefix}${Math.max(0, ...numbers) + 1}`
}

const getFriendlyAiError = (value: unknown) => {
  const raw = typeof value === 'string' ? value : value instanceof Error ? value.message : JSON.stringify(value || '')
  const lower = raw.toLowerCase()

  if (lower.includes('429') || lower.includes('rate-limit') || lower.includes('rate limited')) {
    return 'AI provider is temporarily rate-limited. Please wait a moment and try again.'
  }
  if (lower.includes('api key')) {
    return 'AI provider key is missing or not available on this deployment.'
  }
  if (lower.includes('empty content')) {
    return 'AI could not read this file clearly. Please try a clearer PDF/image or fill manually.'
  }
  return raw.slice(0, 240) || 'AI scan failed. Please fill manually.'
}

const addAnnualDueDate = (dateValue?: string) => {
  if (!dateValue) return ''
  const date = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  date.setFullYear(date.getFullYear() + 1)
  date.setDate(date.getDate() - 1)
  return date.toISOString().slice(0, 10)
}

const shouldDeriveAnnualDueDate = (category?: string, certName?: string) => {
  const normalizedCategory = String(category || '').toLowerCase()
  const normalizedName = String(certName || '').toLowerCase()
  const annualCategories = ['ffe', 'lsa', 'gmdss']
  const annualKeywords = [
    'annual',
    'inspection',
    'test',
    'testing',
    'service',
    'servicing',
    'fixed foam',
    'foam test',
    'fire extinguisher',
    'co2',
    'life raft',
    'epirb',
    'sart',
    'ais',
    'ssas',
  ]

  return annualCategories.includes(normalizedCategory) && annualKeywords.some((keyword) => normalizedName.includes(keyword))
}

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onloadend = () => resolve(String(reader.result || ''))
  })

export default function ShipCertificatesPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<ShipCertificate[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | ShipCertificateStatus>('all')
  const [dashboardFilter, setDashboardFilter] = useState<DashboardFilter>('all')
  const [editingCert, setEditingCert] = useState<ShipCertificate | null>(null)
  const [editForm, setEditForm] = useState<ShipCertificateForm | null>(null)
  const [isAddingCert, setIsAddingCert] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [scanResult, setScanResult] = useState<ShipCertScanResult | null>(null)
  const [scanMessage, setScanMessage] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const user = readCurrentUser()
    if (!user) {
      router.replace('/login')
      return
    }
    setCurrentUser(user)
    setCanEdit(isAdminRole(user.position))
    if (!canViewShipCertificates(user.position)) {
      router.replace('/dashboard')
      return
    }

    fetchData()
  }, [router])

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

  const openEditModal = (row: ShipCertificate) => {
    setEditingCert(row)
    setEditForm(buildFormFromCert(row))
    setIsAddingCert(false)
    setUploadFile(null)
    setScanResult(null)
    setScanMessage('')
  }

  const openAddCertModal = () => {
    const nextSortOrder = Math.max(0, ...rows.map((row) => row.sort_order || 0)) + 1
    const defaultCategory = categoryFilter === 'all' ? 'Flag' : categoryFilter
    const draft = {
      ...buildBlankShipCert(nextSortOrder, defaultCategory),
      code: getNextCertCode(rows, defaultCategory),
    }
    setEditingCert(draft)
    setEditForm(buildFormFromCert(draft))
    setIsAddingCert(true)
    setUploadFile(null)
    setScanResult(null)
    setScanMessage('')
  }

  const closeEditModal = () => {
    setEditingCert(null)
    setEditForm(null)
    setIsAddingCert(false)
    setUploadFile(null)
    setScanResult(null)
    setScanMessage('')
  }

  const handleShipAiScan = async () => {
    if (!editingCert || !editForm || !uploadFile) return
    setIsScanning(true)
    setScanMessage('Preparing AI Vision analysis...')
    setScanResult(null)
    setErrorMessage('')

    try {
      const isPdf = uploadFile.type === 'application/pdf' || uploadFile.name.toLowerCase().endsWith('.pdf')
      const mimeType = isPdf ? 'application/pdf' : 'image/jpeg'
      const fileBase64 = isPdf ? await readFileAsDataUrl(uploadFile) : await compressImage(uploadFile)

      const modelErrors: string[] = []
      let latestError = 'AI models busy'
      for (const model of shipCertificateAiModels) {
        setScanMessage(`AI Vision - trying: ${model.label}`)
        try {
          const res = await fetch('/api/ship-cert-ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileBase64,
              mimeType,
              certName: isAddingCert ? '' : editForm.cert_name || editingCert.cert_name,
              code: editForm.code || editingCert.code,
              category: editForm.category || editingCert.category,
              analysisFocus: 'full_certificate',
              modelId: model.id,
              provider: model.provider,
            }),
          })
          const result = await res.json()
          if (!res.ok || result.error) {
            latestError = getFriendlyAiError(result.error || latestError)
            modelErrors.push(`${model.label}: ${latestError}`)
            throw new Error(latestError)
          }

          const currentRemark = editForm.remark.trim()
          const detectedNumber = String(result.certificateNumber || '').trim()
          const nextRemark = currentRemark || detectedNumber
          const detectedName = isAddingCert && result.detectedCertName ? result.detectedCertName : editForm.cert_name
          const baseAnnualDate = result.lastSurveyDate || result.issuedDate || editForm.last_survey_date || editForm.issued_date
          const derivedAnnualDue = shouldDeriveAnnualDueDate(editForm.category, detectedName) ? addAnnualDueDate(baseAnnualDate) : ''
          const nextExpiryDate = result.expiryDate || editForm.expiry_date || derivedAnnualDue
          const nextSurveyDate = result.nextSurveyDate || editForm.next_survey_date || derivedAnnualDue

          setScanResult(result)
          setEditForm({
            ...editForm,
            cert_name: detectedName,
            issue_by: result.issueBy || editForm.issue_by,
            issued_date: result.issuedDate || editForm.issued_date,
            expiry_date: nextExpiryDate,
            last_survey_date: result.lastSurveyDate || editForm.last_survey_date,
            next_survey_date: nextSurveyDate,
            has_expiry: editForm.has_expiry || !!nextExpiryDate,
            has_survey: editForm.has_survey || !!nextSurveyDate,
            remark: cleanCertificateRemark(nextRemark),
          })
          setScanMessage(`AI Vision analyzed by: ${model.label}`)
          return
        } catch (error: any) {
          latestError = getFriendlyAiError(error)
          if (!modelErrors.some((item) => item.startsWith(`${model.label}:`))) {
            modelErrors.push(`${model.label}: ${latestError}`)
          }
        }
      }

      throw new Error(modelErrors.join(' | ') || latestError)
    } catch (error: any) {
      setScanMessage(getFriendlyAiError(error))
    } finally {
      setIsScanning(false)
    }
  }

  const saveCertificateUpdate = async () => {
    if (!editingCert || !editForm) return
    setIsSaving(true)
    setErrorMessage('')

    const certName = editForm.cert_name.trim()
    if (!certName) {
      setErrorMessage('Please enter certificate name before saving.')
      setIsSaving(false)
      return
    }

    if (!isAddingCert && scanResult?.certTypeMatch === false) {
      setErrorMessage('AI thinks this file does not match the selected ship certificate. Please upload the correct certificate or clear/re-scan.')
      setIsSaving(false)
      return
    }

    let fileUrl = editingCert.file_url || null
    if (uploadFile) {
      const filePath = buildShipCertFilePath(editingCert, uploadFile, editForm)
      const { error: uploadError } = await supabase.storage.from(SHIP_CERT_BUCKET).upload(filePath, uploadFile, { upsert: true })
      if (uploadError) {
        setErrorMessage(`Upload failed: ${uploadError.message}`)
        setIsSaving(false)
        return
      }
      const { data: publicData } = supabase.storage.from(SHIP_CERT_BUCKET).getPublicUrl(filePath)
      fileUrl = publicData.publicUrl
    }

    const nextData = {
      vessel_name: editingCert.vessel_name || 'Kamala Thanee',
      category: editForm.category,
      code: editForm.code.trim() || null,
      cert_name: certName,
      issue_by: editForm.issue_by.trim() || null,
      issued_date: editForm.issued_date || null,
      expiry_date: editForm.has_expiry ? editForm.expiry_date || null : null,
      last_survey_date: editForm.has_survey ? editForm.last_survey_date || null : null,
      next_survey_date: editForm.has_survey ? editForm.next_survey_date || null : null,
      remark: editForm.remark.trim() || null,
      file_url: fileUrl,
      has_expiry: editForm.has_expiry,
      has_survey: editForm.has_survey,
      sort_order: editingCert.sort_order || 0,
      updated_at: new Date().toISOString(),
    }

    const query = isAddingCert
      ? supabase.from('ship_certificates').insert(nextData).select('*').single()
      : supabase.from('ship_certificates').update(nextData).eq('id', editingCert.id).select('*').single()

    const { data, error } = await query

    if (error) {
      setErrorMessage(`Save failed: ${error.message}`)
      setIsSaving(false)
      return
    }
    if (!data) {
      setErrorMessage('Save failed: no ship certificate data returned.')
      setIsSaving(false)
      return
    }

    await supabase.from('ship_cert_history').insert({
      ship_certificate_id: data.id,
      action: isAddingCert ? 'add_certificate' : uploadFile ? 'renew_upload' : 'manual_update',
      old_data: editingCert,
      new_data: data,
      actor_name: currentUser?.full_name || currentUser?.position || 'Unknown user',
    })

    setRows((prev) => {
      if (isAddingCert) return [...prev, data as ShipCertificate].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      return prev.map((row) => (row.id === editingCert.id ? data as ShipCertificate : row))
    })
    setIsSaving(false)
    closeEditModal()
  }

  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    return rows.filter((row) => {
      const status = getShipCertificateStatus(row)
      const survey = getShipSurveyStatus(row)
      const text = [row.code, row.cert_name, row.issue_by, row.remark, row.category].filter(Boolean).join(' ').toLowerCase()
      const matchesDashboard =
        dashboardFilter === 'all' ||
        (dashboardFilter === 'expired' && status === 'expired') ||
        (dashboardFilter === 'due30' && status === 'due-30') ||
        (dashboardFilter === 'due90' && ['due-30', 'due-60', 'due-90'].includes(status)) ||
        (dashboardFilter === 'surveyDue' && ['survey-overdue', 'survey-due-30', 'survey-due-60', 'survey-due-90'].includes(survey))

      return (
        (!query || text.includes(query)) &&
        (categoryFilter === 'all' || row.category === categoryFilter) &&
        (statusFilter === 'all' || status === statusFilter) &&
        matchesDashboard
      )
    })
  }, [categoryFilter, dashboardFilter, rows, searchTerm, statusFilter])

  const summary = useMemo(() => {
    const scopedRows = categoryFilter === 'all' ? rows : rows.filter((row) => row.category === categoryFilter)
    const counts = {
      total: scopedRows.length,
      expired: 0,
      due30: 0,
      due90: 0,
      surveyDue: 0,
      noExpiry: 0,
    }

    for (const row of scopedRows) {
      const status = getShipCertificateStatus(row)
      const survey = getShipSurveyStatus(row)
      if (status === 'expired') counts.expired += 1
      if (status === 'due-30') counts.due30 += 1
      if (['due-30', 'due-60', 'due-90'].includes(status)) counts.due90 += 1
      if (status === 'no-expiry') counts.noExpiry += 1
      if (['survey-overdue', 'survey-due-30', 'survey-due-60', 'survey-due-90'].includes(survey)) counts.surveyDue += 1
    }

    return counts
  }, [categoryFilter, rows])

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
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/10 px-5 py-4 text-xs normal-case text-cyan-100">
              Phase 1: checklist foundation from document 11.62
            </div>
            {canEdit && (
              <button
                onClick={openAddCertModal}
                className="inline-flex items-center justify-center gap-2 rounded-3xl border border-emerald-400/30 bg-emerald-500 px-5 py-4 text-xs font-black uppercase tracking-widest text-black shadow-lg shadow-emerald-500/20 hover:bg-emerald-300"
              >
                <PlusCircle size={16} /> Add New Cert
              </button>
            )}
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
          <SummaryCard label="Total" value={summary.total} tone="cyan" detail="Current category" active={dashboardFilter === 'all' && statusFilter === 'all'} onClick={() => { setDashboardFilter('all'); setStatusFilter('all') }} />
          <SummaryCard label="Expired" value={summary.expired} tone="red" detail="Needs immediate action" active={dashboardFilter === 'expired'} onClick={() => { setDashboardFilter('expired'); setStatusFilter('all') }} />
          <SummaryCard label="Due 30d" value={summary.due30} tone="orange" detail="Renew now" active={dashboardFilter === 'due30'} onClick={() => { setDashboardFilter('due30'); setStatusFilter('all') }} />
          <SummaryCard label="Due 90d" value={summary.due90} tone="amber" detail="Planning window" active={dashboardFilter === 'due90'} onClick={() => { setDashboardFilter('due90'); setStatusFilter('all') }} />
          <SummaryCard label="Survey Due" value={summary.surveyDue} tone="purple" detail="Class endorsement" active={dashboardFilter === 'surveyDue'} onClick={() => { setDashboardFilter('surveyDue'); setStatusFilter('all') }} />
        </section>

        <section className="overflow-x-auto rounded-[28px] border border-cyan-500/10 bg-black/25 p-2">
          <div className="flex min-w-max gap-2">
            {categories.map((category) => {
              const count = category === 'all' ? rows.length : rows.filter((row) => row.category === category).length
              const active = categoryFilter === category
              return (
                <button
                  key={category}
                  onClick={() => {
                    setCategoryFilter(category)
                    setDashboardFilter('all')
                    setStatusFilter('all')
                  }}
                  className={`rounded-2xl border px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${
                    active
                      ? 'border-cyan-300 bg-cyan-400 text-black shadow-lg shadow-cyan-500/20'
                      : 'border-white/10 bg-white/5 text-zinc-400 hover:border-cyan-400/40 hover:text-cyan-100'
                  }`}
                >
                  {category === 'all' ? 'All' : category}
                  <span className={`ml-2 rounded-full px-2 py-1 ${active ? 'bg-black/20 text-black' : 'bg-black/40 text-zinc-500'}`}>{count}</span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="rounded-[34px] border border-white/10 bg-black/30 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px]">
            <label className="flex items-center gap-3 rounded-2xl border border-cyan-500/20 bg-black/40 px-4">
              <Search size={16} className="text-cyan-300" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search certificate, issuer, remark..."
                className="h-14 w-full bg-transparent text-sm font-bold text-white outline-none placeholder:text-zinc-600"
              />
            </label>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as 'all' | ShipCertificateStatus)
                setDashboardFilter('all')
              }}
              className="h-14 rounded-2xl border border-cyan-500/20 bg-black/60 px-4 text-xs font-black uppercase text-white outline-none"
            >
              {statusFilters.map((status) => <option key={status} value={status}>{status === 'all' ? 'All Status' : getShipStatusLabel(status)}</option>)}
            </select>
          </div>
        </section>

        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
          {filteredRows.length} shown / {summary.total} records in {categoryFilter === 'all' ? 'all categories' : categoryFilter}
        </p>

        <section className="overflow-x-auto rounded-[34px] border border-white/10 bg-black/30">
          <div className="hidden min-w-[1040px] grid-cols-[70px_105px_minmax(180px,1.35fr)_120px_120px_170px_minmax(120px,0.8fr)_100px] gap-3 border-b border-white/10 px-5 py-5 text-[9px] font-black uppercase tracking-widest text-zinc-500 md:grid">
            <span>Code</span>
            <span>Category</span>
            <span>Certificate</span>
            <span>Expiry</span>
            <span>Status</span>
            <span>Survey</span>
            <span>Remark</span>
            <span>Action</span>
          </div>
          {filteredRows.length === 0 ? (
            <div className="p-12 text-center text-sm font-black uppercase tracking-widest text-zinc-600">
              No ship certificates found
            </div>
          ) : filteredRows.map((row) => (
            <ShipCertificateRow key={row.id || `${row.category}-${row.code}-${row.cert_name}`} row={row} canEdit={canEdit} onEdit={openEditModal} />
          ))}
        </section>
      </div>

      {editingCert && editForm && (
        <ShipCertificateModal
          certificate={editingCert}
          form={editForm}
          isAddingCert={isAddingCert}
          uploadFile={uploadFile}
          scanResult={scanResult}
          scanMessage={scanMessage}
          isScanning={isScanning}
          isSaving={isSaving}
          onFormChange={setEditForm}
          onCategoryChange={(category) => {
            setEditForm((prev) => prev ? { ...prev, category, code: isAddingCert ? getNextCertCode(rows, category) : prev.code } : prev)
          }}
          onFileChange={(file) => {
            setUploadFile(file)
            setScanResult(null)
            setScanMessage('')
          }}
          onAiScan={handleShipAiScan}
          onClose={closeEditModal}
          onSave={saveCertificateUpdate}
        />
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  detail,
  tone,
  active,
  onClick,
}: {
  label: string
  value: number
  detail: string
  tone: 'cyan' | 'red' | 'orange' | 'amber' | 'purple'
  active: boolean
  onClick: () => void
}) {
  const tones = {
    cyan: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200',
    red: 'border-red-500/20 bg-red-500/10 text-red-200',
    orange: 'border-orange-500/20 bg-orange-500/10 text-orange-200',
    amber: 'border-amber-500/20 bg-amber-500/10 text-amber-200',
    purple: 'border-purple-500/20 bg-purple-500/10 text-purple-200',
  }

  return (
    <button
      onClick={onClick}
      className={`rounded-[32px] border p-6 text-left shadow-xl transition-all hover:-translate-y-0.5 ${
        active ? `${tones[tone]} ring-2 ring-white/70` : `${tones[tone]} opacity-80 hover:opacity-100`
      }`}
    >
      <p className="text-[9px] font-black uppercase tracking-[0.3em]">{label}</p>
      <p className="mt-5 text-4xl font-black text-white">{value}</p>
      <p className="mt-2 text-xs normal-case text-zinc-300">{detail}</p>
    </button>
  )
}

function ShipCertificateModal({
  certificate,
  form,
  isAddingCert,
  uploadFile,
  scanResult,
  scanMessage,
  isScanning,
  isSaving,
  onFormChange,
  onCategoryChange,
  onFileChange,
  onAiScan,
  onClose,
  onSave,
}: {
  certificate: ShipCertificate
  form: ShipCertificateForm
  isAddingCert: boolean
  uploadFile: File | null
  scanResult: ShipCertScanResult | null
  scanMessage: string
  isScanning: boolean
  isSaving: boolean
  onFormChange: (form: ShipCertificateForm) => void
  onCategoryChange: (category: string) => void
  onFileChange: (file: File | null) => void
  onAiScan: () => void
  onClose: () => void
  onSave: () => void
}) {
  const showExtractedFields = !isAddingCert || !!form.cert_name || !!scanResult

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-xl">
      <div className="w-full max-w-3xl overflow-hidden rounded-[40px] border border-cyan-500/20 bg-zinc-950 shadow-2xl">
        <div className="flex items-start justify-between border-b border-white/10 p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-300">{isAddingCert ? 'Add New Ship Certificate' : 'Edit / Update Ship Certificate'}</p>
            <h2 className="mt-2 text-2xl font-black italic text-white">{form.code || certificate.code || 'NEW'} · {form.cert_name || certificate.cert_name || 'New certificate'}</h2>
            <p className="mt-1 text-xs normal-case text-zinc-500">AI assist can prefill fields. Admin must still review before saving.</p>
          </div>
          <button onClick={onClose} className="rounded-2xl bg-white/5 p-3 text-zinc-400 hover:bg-white/10 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="grid max-h-[70vh] gap-4 overflow-y-auto p-6 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Category</span>
            <select
              value={form.category}
              onChange={(event) => onCategoryChange(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black p-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
            >
              {editableCategories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Cert Code</span>
            <input value={form.code} onChange={(event) => onFormChange({ ...form, code: event.target.value.toUpperCase() })} readOnly={isAddingCert} placeholder="Auto code" className={`w-full rounded-2xl border border-white/10 bg-black p-4 text-sm font-bold text-white outline-none focus:border-cyan-400 ${isAddingCert ? 'cursor-not-allowed text-cyan-200' : ''}`} />
            {isAddingCert && <p className="text-[10px] normal-case text-cyan-200/70">Auto-generated from selected category.</p>}
          </label>
          {!isAddingCert && (
            <label className="space-y-2 md:col-span-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Certificate Name</span>
              <input value={form.cert_name} onChange={(event) => onFormChange({ ...form, cert_name: event.target.value })} placeholder="Certificate title" className="w-full rounded-2xl border border-white/10 bg-black p-4 text-sm font-bold text-white outline-none focus:border-cyan-400" />
            </label>
          )}
          <label className="space-y-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Certificate File</span>
            <input type="file" accept="application/pdf,image/*" onChange={(event) => onFileChange(event.target.files?.[0] || null)} className="w-full rounded-2xl border border-white/10 bg-black p-3 text-xs font-bold text-white file:mr-3 file:rounded-xl file:border-0 file:bg-cyan-600 file:px-3 file:py-2 file:text-white" />
            {uploadFile && <p className="text-[10px] normal-case text-cyan-200">{uploadFile.name}</p>}
          </label>
          {isAddingCert && form.cert_name && (
            <label className="space-y-2 md:col-span-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">AI-detected Certificate Name</span>
              <input value={form.cert_name} onChange={(event) => onFormChange({ ...form, cert_name: event.target.value })} className="w-full rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm font-bold text-white outline-none focus:border-emerald-400" />
            </label>
          )}
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 md:col-span-2">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-cyan-300">AI Vision Assist</p>
                <p className="mt-1 text-xs normal-case text-zinc-400">For scanned ship certificates. AI fills fields, then admin reviews and can edit before saving.</p>
              </div>
              <button
                type="button"
                onClick={onAiScan}
                disabled={!uploadFile || isScanning}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-500/20 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-cyan-100 hover:bg-cyan-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isScanning ? <Loader2 className="animate-spin" size={15} /> : <UploadCloud size={15} />}
                {isScanning ? 'Analyzing...' : 'AI Vision Analyze'}
              </button>
            </div>
            {(scanMessage || scanResult) && (
              <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-black/40 p-4 text-xs normal-case text-zinc-300">
                {scanMessage && <p className="font-bold text-cyan-200">{scanMessage}</p>}
                {scanResult && (
                  <div className="mt-2 space-y-1">
                    <p>Detected: <span className="font-bold text-white">{scanResult.detectedCertName || '-'}</span></p>
                    <p>Cert No: <span className="font-bold text-white">{scanResult.certificateNumber || '-'}</span></p>
                    <p>Mode: <span className="font-bold text-cyan-200">AI Vision</span></p>
                    <p>Match: <span className={scanResult.certTypeMatch ? 'font-bold text-emerald-300' : 'font-bold text-red-300'}>{scanResult.certTypeMatch ? 'Looks matched' : 'Needs manual review'}</span></p>
                    {scanResult.note && <p className="pt-1 text-zinc-400">AI note: {scanResult.note}</p>}
                  </div>
                )}
              </div>
            )}
          </div>
          {!showExtractedFields && (
            <div className="rounded-2xl border border-dashed border-cyan-500/20 bg-black/30 p-5 text-xs normal-case text-zinc-400 md:col-span-2">
              Upload the certificate and run AI Vision. The remaining fields will appear here for review/edit after AI reads the file.
            </div>
          )}
          {showExtractedFields && (
            <>
              <label className="space-y-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Issue By</span>
                <input value={form.issue_by} onChange={(event) => onFormChange({ ...form, issue_by: event.target.value })} className="w-full rounded-2xl border border-white/10 bg-black p-4 text-sm font-bold text-white outline-none focus:border-cyan-400" />
              </label>
              <DateInput label="Issued Date" value={form.issued_date} onChange={(value) => onFormChange({ ...form, issued_date: value })} />
              <DateInput label="Expiry Date" value={form.expiry_date} onChange={(value) => onFormChange({ ...form, expiry_date: value })} />
              <DateInput label="Last Survey Date" value={form.last_survey_date} onChange={(value) => onFormChange({ ...form, last_survey_date: value })} />
              <DateInput label="Next Survey Date" value={form.next_survey_date} onChange={(value) => onFormChange({ ...form, next_survey_date: value })} />
              <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
                <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-black p-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Track Expiry</span>
                  <input type="checkbox" checked={form.has_expiry} onChange={(event) => onFormChange({ ...form, has_expiry: event.target.checked })} className="h-5 w-5 accent-cyan-400" />
                </label>
                <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-black p-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Track Survey</span>
                  <input type="checkbox" checked={form.has_survey} onChange={(event) => onFormChange({ ...form, has_survey: event.target.checked })} className="h-5 w-5 accent-cyan-400" />
                </label>
              </div>
              <label className="space-y-2 md:col-span-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Remark / Certificate No.</span>
                <textarea value={form.remark} onChange={(event) => onFormChange({ ...form, remark: event.target.value })} rows={3} className="w-full rounded-2xl border border-white/10 bg-black p-4 text-sm font-bold text-white outline-none focus:border-cyan-400" />
              </label>
            </>
          )}
          {certificate.file_url && (
            <a href={certificate.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-cyan-300 hover:text-white md:col-span-2">
              <ExternalLink size={14} /> View current file
            </a>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 p-6 md:flex-row">
          <button onClick={onClose} className="flex-1 rounded-2xl bg-white/5 py-4 text-xs font-black uppercase tracking-widest text-zinc-300 hover:bg-white/10">
            Cancel
          </button>
          <button onClick={onSave} disabled={isSaving} className="flex-1 rounded-2xl bg-cyan-600 py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-cyan-600/20 disabled:cursor-wait disabled:opacity-50">
            {isSaving ? 'Saving...' : isAddingCert ? 'Add Certificate' : 'Confirm & Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-2">
      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onClick={(event) => (event.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()}
        className="w-full rounded-2xl border border-white/10 bg-black p-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
      />
    </label>
  )
}

function ShipCertificateRow({ row, canEdit, onEdit }: { row: ShipCertificate; canEdit: boolean; onEdit: (row: ShipCertificate) => void }) {
  const status = getShipCertificateStatus(row)
  const surveyStatus = getShipSurveyStatus(row)
  const expiryDays = daysUntil(row.expiry_date)
  const surveyDays = daysUntil(row.next_survey_date)

  return (
    <article className="grid grid-cols-1 gap-4 border-b border-white/5 px-5 py-5 last:border-0 md:min-w-[1040px] md:grid-cols-[70px_105px_minmax(180px,1.35fr)_120px_120px_170px_minmax(120px,0.8fr)_100px] md:items-center md:gap-3">
      <div>
        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 md:hidden">Code</p>
        <p className="font-black text-cyan-200">{row.code || '-'}</p>
      </div>
      <div>
        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 md:hidden">Category</p>
        <p className="text-xs font-black uppercase text-zinc-300">{row.category || '-'}</p>
      </div>
      <div>
        <p className="break-words text-sm font-black uppercase italic text-white">{row.cert_name || 'Unknown certificate'}</p>
        <p className="mt-1 text-[11px] normal-case text-zinc-500">
          Issue by {row.issue_by || '-'} · Issued {formatShipDate(row.issued_date)}
        </p>
      </div>
      <div>
        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 md:hidden">Expiry</p>
        <p className="text-sm font-black text-white">{formatShipDate(row.expiry_date)}</p>
        {expiryDays !== null && <p className="mt-1 text-[10px] text-zinc-500">{expiryDays} days</p>}
      </div>
      <span className={`w-fit rounded-full border px-3 py-2 text-[8px] font-black uppercase tracking-widest ${shipStatusStyles[status]}`}>
        {getShipStatusLabel(status)}
      </span>
      <div className={`rounded-2xl border px-3 py-2 text-[8px] font-black uppercase tracking-widest ${shipSurveyStyles[surveyStatus]}`}>
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
      <div className="min-w-0 text-[11px] normal-case text-zinc-400">
        <div className="flex items-center gap-2">
          <FileBadge size={13} className="text-zinc-600" />
          <span className="min-w-0 break-words">{cleanCertificateRemark(row.remark) || '-'}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        {row.file_url && (
          <a href={row.file_url} target="_blank" rel="noreferrer" className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-cyan-300 hover:bg-cyan-500 hover:text-white">
            <ExternalLink size={15} />
          </a>
        )}
        {canEdit && (
          <button onClick={() => onEdit(row)} className="flex items-center gap-2 rounded-xl border border-orange-500/20 bg-orange-500/10 px-3 py-3 text-[8px] font-black uppercase tracking-widest text-orange-300 hover:bg-orange-500 hover:text-white">
            <UploadCloud size={15} /> Edit Cert
          </button>
        )}
      </div>
    </article>
  )
}
