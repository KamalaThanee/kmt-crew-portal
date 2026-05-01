'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CalendarClock, ExternalLink, FileBadge, Loader2, Search, ShipWheel, UploadCloud, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { AI_MODELS, compressImage } from '@/lib/certificateUpload'
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
const statusFilters: Array<'all' | ShipCertificateStatus> = ['all', 'expired', 'due-30', 'due-60', 'due-90', 'due-180', 'valid', 'no-expiry']
const SHIP_CERT_BUCKET = 'ship-certificates'

type ShipCertificateForm = {
  issue_by: string
  issued_date: string
  expiry_date: string
  last_survey_date: string
  next_survey_date: string
  remark: string
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
  const category = sanitizeFilePart(certificate.category, 'Ship_Certificate')
  const certCode = sanitizeFilePart(certificate.code, 'NO_CODE')
  const certName = sanitizeFilePart(certificate.cert_name, 'Certificate')
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
  issue_by: row.issue_by || '',
  issued_date: row.issued_date || '',
  expiry_date: row.expiry_date || '',
  last_survey_date: row.last_survey_date || '',
  next_survey_date: row.next_survey_date || '',
  remark: cleanCertificateRemark(row.remark),
})

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
  const [statusFilter, setStatusFilter] = useState('all')
  const [editingCert, setEditingCert] = useState<ShipCertificate | null>(null)
  const [editForm, setEditForm] = useState<ShipCertificateForm | null>(null)
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
    setUploadFile(null)
    setScanResult(null)
    setScanMessage('')
  }

  const closeEditModal = () => {
    setEditingCert(null)
    setEditForm(null)
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

      let latestError = 'AI models busy'
      for (const model of AI_MODELS) {
        setScanMessage(`AI Vision - trying: ${model.label}`)
        try {
          const res = await fetch('/api/ship-cert-ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileBase64,
              mimeType,
              certName: editingCert.cert_name,
              code: editingCert.code,
              category: editingCert.category,
              analysisFocus: 'full_certificate',
              modelId: model.id,
              provider: model.provider,
            }),
          })
          const result = await res.json()
          if (!res.ok || result.error) {
            latestError = result.error || latestError
            throw new Error(latestError)
          }

          const currentRemark = editForm.remark.trim()
          const detectedNumber = String(result.certificateNumber || '').trim()
          const nextRemark = currentRemark || detectedNumber

          setScanResult(result)
          setEditForm({
            ...editForm,
            issue_by: result.issueBy || editForm.issue_by,
            issued_date: result.issuedDate || editForm.issued_date,
            expiry_date: result.expiryDate || editForm.expiry_date,
            last_survey_date: result.lastSurveyDate || editForm.last_survey_date,
            next_survey_date: result.nextSurveyDate || editForm.next_survey_date,
            remark: cleanCertificateRemark(nextRemark),
          })
          setScanMessage(`AI Vision analyzed by: ${model.label}`)
          return
        } catch (error: any) {
          latestError = error.message || latestError
        }
      }

      throw new Error(latestError)
    } catch (error: any) {
      setScanMessage(error.message || 'AI scan failed. Please fill manually.')
    } finally {
      setIsScanning(false)
    }
  }

  const saveCertificateUpdate = async () => {
    if (!editingCert?.id || !editForm) return
    setIsSaving(true)
    setErrorMessage('')

    if (scanResult?.certTypeMatch === false) {
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
      issue_by: editForm.issue_by.trim() || null,
      issued_date: editForm.issued_date || null,
      expiry_date: editForm.expiry_date || null,
      last_survey_date: editForm.last_survey_date || null,
      next_survey_date: editForm.next_survey_date || null,
      remark: editForm.remark.trim() || null,
      file_url: fileUrl,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('ship_certificates')
      .update(nextData)
      .eq('id', editingCert.id)
      .select('*')
      .single()

    if (error) {
      setErrorMessage(`Save failed: ${error.message}`)
      setIsSaving(false)
      return
    }

    await supabase.from('ship_cert_history').insert({
      ship_certificate_id: editingCert.id,
      action: uploadFile ? 'renew_upload' : 'manual_update',
      old_data: editingCert,
      new_data: data,
      actor_name: currentUser?.full_name || currentUser?.position || 'Unknown user',
    })

    setRows((prev) => prev.map((row) => (row.id === editingCert.id ? data as ShipCertificate : row)))
    setIsSaving(false)
    closeEditModal()
  }

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
          uploadFile={uploadFile}
          scanResult={scanResult}
          scanMessage={scanMessage}
          isScanning={isScanning}
          isSaving={isSaving}
          onFormChange={setEditForm}
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

function ShipCertificateModal({
  certificate,
  form,
  uploadFile,
  scanResult,
  scanMessage,
  isScanning,
  isSaving,
  onFormChange,
  onFileChange,
  onAiScan,
  onClose,
  onSave,
}: {
  certificate: ShipCertificate
  form: ShipCertificateForm
  uploadFile: File | null
  scanResult: ShipCertScanResult | null
  scanMessage: string
  isScanning: boolean
  isSaving: boolean
  onFormChange: (form: ShipCertificateForm) => void
  onFileChange: (file: File | null) => void
  onAiScan: () => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-xl">
      <div className="w-full max-w-3xl overflow-hidden rounded-[40px] border border-cyan-500/20 bg-zinc-950 shadow-2xl">
        <div className="flex items-start justify-between border-b border-white/10 p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-300">Renew / Update Ship Certificate</p>
            <h2 className="mt-2 text-2xl font-black italic text-white">{certificate.code} · {certificate.cert_name}</h2>
            <p className="mt-1 text-xs normal-case text-zinc-500">AI assist can prefill fields. Admin must still review before saving.</p>
          </div>
          <button onClick={onClose} className="rounded-2xl bg-white/5 p-3 text-zinc-400 hover:bg-white/10 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="grid max-h-[70vh] gap-4 overflow-y-auto p-6 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Issue By</span>
            <input value={form.issue_by} onChange={(event) => onFormChange({ ...form, issue_by: event.target.value })} className="w-full rounded-2xl border border-white/10 bg-black p-4 text-sm font-bold text-white outline-none focus:border-cyan-400" />
          </label>
          <label className="space-y-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Certificate File</span>
            <input type="file" accept="application/pdf,image/*" onChange={(event) => onFileChange(event.target.files?.[0] || null)} className="w-full rounded-2xl border border-white/10 bg-black p-3 text-xs font-bold text-white file:mr-3 file:rounded-xl file:border-0 file:bg-cyan-600 file:px-3 file:py-2 file:text-white" />
            {uploadFile && <p className="text-[10px] normal-case text-cyan-200">{uploadFile.name}</p>}
          </label>
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
          <DateInput label="Issued Date" value={form.issued_date} onChange={(value) => onFormChange({ ...form, issued_date: value })} />
          <DateInput label="Expiry Date" value={form.expiry_date} onChange={(value) => onFormChange({ ...form, expiry_date: value })} />
          <DateInput label="Last Survey Date" value={form.last_survey_date} onChange={(value) => onFormChange({ ...form, last_survey_date: value })} />
          <DateInput label="Next Survey Date" value={form.next_survey_date} onChange={(value) => onFormChange({ ...form, next_survey_date: value })} />
          <label className="space-y-2 md:col-span-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Remark / Certificate No.</span>
            <textarea value={form.remark} onChange={(event) => onFormChange({ ...form, remark: event.target.value })} rows={3} className="w-full rounded-2xl border border-white/10 bg-black p-4 text-sm font-bold text-white outline-none focus:border-cyan-400" />
          </label>
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
            {isSaving ? 'Saving...' : 'Confirm & Save'}
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
            <UploadCloud size={15} /> Renew
          </button>
        )}
      </div>
    </article>
  )
}
