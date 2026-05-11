'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarCheck, CheckCircle2, Download, Eye, FileArchive, FileUp, Loader2, Search, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import { readCurrentUser, type CurrentUser } from '@/lib/currentUser'
import { canManageMonthlyReports, normalizeRole } from '@/lib/roles'
import { supabase } from '@/lib/supabase'

const MONTHLY_BUCKET = 'monthly-reports'
const ZIP_POSITIONS = ['Chief Engineer', 'Chief Officer', 'Safety Officer'] as const
const UPLOAD_POSITIONS = ['All Positions', ...ZIP_POSITIONS] as const
const SCHEDULES = ['All Schedules', 'Weekly', 'Inventory', 'Monthly Report']

type MonthlyReportMaster = {
  id: string
  schedule: string
  form_no: string
  details: string
  period: string | null
  pic: string
  sort_order: number
}

type MonthlyReportSubmission = {
  id: string
  master_id: string
  report_month: string
  status: string
  file_name: string | null
  file_path: string | null
  file_url: string | null
  file_size: number | null
  mime_type: string | null
  remarks: string | null
  uploaded_by_name: string | null
  uploaded_at: string | null
}

type MonthlyReportRow = MonthlyReportMaster & {
  submission?: MonthlyReportSubmission
}

const monthValue = (date = new Date()) => date.toISOString().slice(0, 7)
const reportMonthValue = (month: string) => `${month}-01`

const safeFileName = (value: string) =>
  String(value || 'monthly-report')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '_')
    .slice(0, 150)

const formatDateTime = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

const formatMonth = (value: string) => {
  const date = new Date(`${value}-01T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

const splitPicRoles = (pic: string) =>
  String(pic || '')
    .split('/')
    .map((item) => item.trim())
    .filter(Boolean)

const roleMatchesPic = (position: unknown, pic: string) => {
  const normalizedPosition = normalizeRole(position)
  return splitPicRoles(pic).some((role) => normalizeRole(role) === normalizedPosition)
}

const isUploadPositionRow = (row: MonthlyReportMaster) =>
  ZIP_POSITIONS.some((position) => splitPicRoles(row.pic).includes(position))

const rowMatchesPositionFilter = (row: MonthlyReportMaster, position: string) =>
  position === 'All Positions' || splitPicRoles(row.pic).includes(position)

const buildStoredFileName = (row: MonthlyReportRow, month: string, originalName: string) => {
  const ext = originalName.includes('.') ? originalName.split('.').pop() || 'file' : 'file'
  const docNo = row.form_no && row.form_no !== 'N/A' ? row.form_no : 'NA'
  return safeFileName(`KMT-${docNo}-${row.details}-${formatMonth(month)}.${ext}`)
}

const openFileUrl = (fileUrl: string, fileName?: string | null) => {
  const ext = String(fileName || fileUrl).split('?')[0].split('.').pop()?.toLowerCase() || ''
  const officeExts = new Set(['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'])
  const previewUrl = officeExts.has(ext)
    ? `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(fileUrl)}`
    : fileUrl

  window.open(previewUrl, '_blank', 'noopener,noreferrer')
}

export default function MonthlyReportsPage() {
  const router = useRouter()
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [masters, setMasters] = useState<MonthlyReportMaster[]>([])
  const [submissions, setSubmissions] = useState<MonthlyReportSubmission[]>([])
  const [selectedMonth, setSelectedMonth] = useState(monthValue())
  const [scheduleFilter, setScheduleFilter] = useState('All Schedules')
  const [picFilter, setPicFilter] = useState('All Positions')
  const [statusFilter, setStatusFilter] = useState('All Status')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [downloadingZip, setDownloadingZip] = useState<string | null>(null)

  const canManage = canManageMonthlyReports(user?.position)

  useEffect(() => {
    const current = readCurrentUser()
    if (!current) {
      router.push('/login')
      return
    }
    setUser(current)
  }, [router])

  useEffect(() => {
    if (!user) return
    fetchData()
  }, [user, selectedMonth])

  const fetchData = async () => {
    setLoading(true)
    const [masterRes, submissionRes] = await Promise.all([
      supabase
        .from('monthly_report_master')
        .select('id, schedule, form_no, details, period, pic, sort_order')
        .eq('active', true)
        .order('sort_order'),
      supabase
        .from('monthly_report_submissions')
        .select('id, master_id, report_month, status, file_name, file_path, file_url, file_size, mime_type, remarks, uploaded_by_name, uploaded_at')
        .eq('report_month', reportMonthValue(selectedMonth)),
    ])

    if (masterRes.error) {
      toast.error(`${masterRes.error.message}. Run sql/monthly_reports.sql first.`)
      setMasters([])
    } else {
      setMasters((masterRes.data || []) as MonthlyReportMaster[])
    }

    if (submissionRes.error) {
      toast.error(submissionRes.error.message)
      setSubmissions([])
    } else {
      setSubmissions((submissionRes.data || []) as MonthlyReportSubmission[])
    }
    setLoading(false)
  }

  const rows = useMemo<MonthlyReportRow[]>(() => {
    const submissionByMaster = new Map(submissions.map((item) => [item.master_id, item]))
    return masters.map((master) => ({ ...master, submission: submissionByMaster.get(master.id) }))
  }, [masters, submissions])

  const accessibleRows = useMemo(() => {
    if (canManage) return rows
    return rows.filter((row) => roleMatchesPic(user?.position, row.pic))
  }, [canManage, rows, user?.position])

  const visibleRows = useMemo(() => {
    const q = search.toLowerCase().trim()
    return accessibleRows
      .filter(isUploadPositionRow)
      .filter((row) => scheduleFilter === 'All Schedules' || row.schedule === scheduleFilter)
      .filter((row) => rowMatchesPositionFilter(row, picFilter))
      .filter((row) => {
        if (statusFilter === 'All Status') return true
        const uploaded = Boolean(row.submission?.file_url)
        return statusFilter === 'Uploaded' ? uploaded : !uploaded
      })
      .filter((row) => !q || `${row.form_no} ${row.details} ${row.pic} ${row.schedule}`.toLowerCase().includes(q))
  }, [accessibleRows, picFilter, scheduleFilter, search, statusFilter])

  const uploadRows = useMemo(() => accessibleRows.filter(isUploadPositionRow), [accessibleRows])

  const positionStats = useMemo(() => {
    return UPLOAD_POSITIONS.map((position) => {
      const scopedRows = uploadRows.filter((row) => rowMatchesPositionFilter(row, position))
      const uploaded = scopedRows.filter((row) => row.submission?.file_url).length
      const required = scopedRows.length
      const pending = Math.max(required - uploaded, 0)
      const percent = required ? Math.round((uploaded / required) * 100) : 0
      return { position, required, uploaded, pending, percent }
    })
  }, [uploadRows])

  const canUploadRow = (row: MonthlyReportRow) => canManage || roleMatchesPic(user?.position, row.pic)

  const handleUpload = async (row: MonthlyReportRow, file?: File) => {
    if (!file || !user) return
    setUploadingId(row.id)
    try {
      const storedName = buildStoredFileName(row, selectedMonth, file.name)
      const path = `${selectedMonth}/${safeFileName(row.pic)}/${row.id}/${Date.now()}-${storedName}`
      const { error: uploadError } = await supabase.storage.from(MONTHLY_BUCKET).upload(path, file, { upsert: true })
      if (uploadError) throw uploadError

      const { data: publicData } = supabase.storage.from(MONTHLY_BUCKET).getPublicUrl(path)
      const payload = {
        master_id: row.id,
        report_month: reportMonthValue(selectedMonth),
        status: 'uploaded',
        file_name: storedName,
        file_path: path,
        file_url: publicData.publicUrl,
        file_size: file.size,
        mime_type: file.type || null,
        uploaded_by: user.id || null,
        uploaded_by_name: user.full_name || 'Unknown',
        uploaded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const { error: saveError } = await supabase
        .from('monthly_report_submissions')
        .upsert(payload, { onConflict: 'master_id,report_month' })
      if (saveError) throw saveError

      toast.success('Monthly report uploaded')
      await fetchData()
    } catch (error: any) {
      toast.error(error?.message || 'Upload failed')
    } finally {
      setUploadingId(null)
    }
  }

  const triggerBlobDownload = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  const downloadFile = async (row: MonthlyReportRow) => {
    const fileUrl = row.submission?.file_url
    if (!fileUrl) return toast.error('No file uploaded yet')
    try {
      const response = await fetch(fileUrl)
      if (!response.ok) throw new Error('Unable to download file')
      triggerBlobDownload(await response.blob(), row.submission?.file_name || `${row.form_no}-${row.details}`)
    } catch (error: any) {
      toast.error(error?.message || 'Download failed')
    }
  }

  const downloadPositionZip = async (position: string) => {
    const rowsToZip = rows.filter((row) => splitPicRoles(row.pic).includes(position) && row.submission?.file_url)
    if (rowsToZip.length === 0) return toast.error(`No uploaded files for ${position}`)
    setDownloadingZip(position)
    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()

      for (const row of rowsToZip) {
        const fileUrl = row.submission?.file_url
        if (!fileUrl) continue
        const response = await fetch(fileUrl)
        if (!response.ok) continue
        const fileName = row.submission?.file_name || buildStoredFileName(row, selectedMonth, 'file')
        zip.file(safeFileName(fileName), await response.blob())
      }

      const blob = await zip.generateAsync({ type: 'blob' })
      triggerBlobDownload(blob, `KMT_MonthlyReports_${safeFileName(position)}_${selectedMonth}.zip`)
    } catch (error: any) {
      toast.error(error?.message || 'ZIP download failed')
    } finally {
      setDownloadingZip(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#02030b] px-4 pb-28 pt-28 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <section className="mb-10 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-3 text-orange-500">
              <CalendarCheck size={38} />
              <h1 className="text-4xl font-black italic uppercase tracking-tight md:text-5xl">Monthly Reports</h1>
            </div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-zinc-500">Monthly submission control and radio operator ZIP collection</p>
          </div>

          <div className="flex flex-col gap-3 rounded-[28px] border border-orange-500/25 bg-black/60 p-4 md:min-w-[420px]">
            <label className="text-[10px] font-black uppercase tracking-[0.25em] text-orange-300">Report Month</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="rounded-2xl border border-zinc-800 bg-black px-5 py-4 text-sm font-black text-white outline-none focus:border-orange-500"
            />
          </div>
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          {positionStats.map((item) => {
            const active = picFilter === item.position
            const title = item.position === 'All Positions' ? 'All Uploaders' : item.position
            return (
              <button
                key={item.position}
                onClick={() => setPicFilter(item.position)}
                className={`rounded-[30px] border p-6 text-left transition-all ${active ? 'border-orange-200 bg-[#1b1010] shadow-xl shadow-orange-500/10' : 'border-orange-500/20 bg-black/55 hover:border-orange-500/50'}`}
              >
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-200">{title}</p>
                <div className="mt-6 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-5xl font-black">{item.required}</p>
                    <p className="mt-3 text-sm font-bold text-zinc-400">Required items</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-emerald-300">{item.uploaded}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Uploaded</p>
                    <p className="mt-2 text-2xl font-black text-red-300">{item.pending}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Pending</p>
                  </div>
                </div>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-orange-500" style={{ width: `${item.percent}%` }} />
                </div>
              </button>
            )
          })}
        </section>

        {canManage && (
          <section className="mb-8 rounded-[30px] border border-orange-500/20 bg-black/60 p-5">
            <div className="mb-4 flex items-center gap-2 text-orange-300">
              <FileArchive size={18} />
              <h2 className="text-sm font-black uppercase tracking-[0.25em]">Radio Operator Collection ZIP</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {ZIP_POSITIONS.map((position) => (
                <button
                  key={position}
                  onClick={() => downloadPositionZip(position)}
                  disabled={downloadingZip === position}
                  className="rounded-[24px] border border-blue-500/35 bg-blue-500/10 px-5 py-4 text-xs font-black uppercase tracking-widest text-blue-100 transition hover:bg-blue-500/20 disabled:opacity-50"
                >
                  {downloadingZip === position ? <Loader2 size={16} className="mr-2 inline animate-spin" /> : <Download size={16} className="mr-2 inline" />}
                  Download {position} ZIP
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="mb-8 rounded-[30px] border border-white/15 bg-black/55 p-4">
          <div className="grid gap-3 md:grid-cols-[1.4fr_0.8fr_0.8fr]">
            <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-black px-4">
              <Search size={18} className="text-orange-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search form no, document, PIC..."
                className="h-14 w-full bg-transparent text-sm font-bold text-white outline-none placeholder:text-zinc-600"
              />
            </div>
            <select value={scheduleFilter} onChange={(event) => setScheduleFilter(event.target.value)} className="h-14 rounded-2xl border border-zinc-800 bg-black px-4 text-sm font-black text-white outline-none">
              {SCHEDULES.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-14 rounded-2xl border border-zinc-800 bg-black px-4 text-sm font-black text-white outline-none">
              {['All Status', 'Uploaded', 'Pending'].map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
        </section>

        <p className="mb-4 text-xs font-black uppercase tracking-[0.25em] text-zinc-500">{visibleRows.length} shown / {uploadRows.length} upload records</p>

        <section className="overflow-hidden rounded-[30px] border border-white/15 bg-[#080913]">
          {loading ? (
            <div className="flex min-h-[260px] items-center justify-center text-zinc-500">
              <Loader2 className="mr-3 animate-spin" /> Loading monthly reports...
            </div>
          ) : visibleRows.length === 0 ? (
            <div className="flex min-h-[260px] items-center justify-center text-sm font-black uppercase tracking-widest text-zinc-600">No monthly report items found</div>
          ) : (
            <div className="divide-y divide-white/10">
              {visibleRows.map((row) => {
                const uploaded = Boolean(row.submission?.file_url)
                return (
                  <article key={row.id} className="grid gap-5 p-6 md:grid-cols-[0.65fr_1.45fr_0.8fr_1.15fr] md:items-center">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-orange-300">{row.schedule}</p>
                      <h3 className="mt-3 text-2xl font-black italic uppercase text-white">{row.form_no}</h3>
                      <p className="mt-2 text-xs font-bold text-zinc-500">{row.period || '-'}</p>
                    </div>

                    <div>
                      <h4 className="text-lg font-black text-white">{row.details}</h4>
                      <p className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-blue-200">{row.pic}</p>
                    </div>

                    <div>
                      <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest ${uploaded ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border border-amber-500/30 bg-amber-500/10 text-amber-200'}`}>
                        {uploaded ? <CheckCircle2 size={14} /> : <FileUp size={14} />}
                        {uploaded ? 'Uploaded' : 'Pending'}
                      </span>
                      {uploaded && (
                        <p className="mt-3 text-xs font-bold text-zinc-500">
                          By {row.submission?.uploaded_by_name || 'Unknown'}<br />
                          {formatDateTime(row.submission?.uploaded_at)}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 md:items-end">
                      {uploaded && (
                        <div className="flex gap-2">
                          <button onClick={() => openFileUrl(String(row.submission?.file_url), row.submission?.file_name)} className="rounded-2xl border border-blue-500/35 bg-blue-500/10 px-4 py-3 text-xs font-black uppercase text-blue-100">
                            <Eye size={15} className="mr-2 inline" /> View
                          </button>
                          <button onClick={() => downloadFile(row)} className="rounded-2xl border border-blue-500/35 bg-blue-500/10 px-4 py-3 text-xs font-black uppercase text-blue-100">
                            <Download size={15} className="mr-2 inline" /> Download
                          </button>
                        </div>
                      )}

                      {canUploadRow(row) && (
                        <label className="cursor-pointer rounded-2xl bg-orange-600 px-5 py-3 text-center text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-orange-600/20">
                          {uploadingId === row.id ? <Loader2 size={15} className="mr-2 inline animate-spin" /> : <UploadCloud size={15} className="mr-2 inline" />}
                          {uploaded ? 'Replace File' : 'Upload File'}
                          <input
                            type="file"
                            className="hidden"
                            disabled={uploadingId === row.id}
                            onChange={(event) => handleUpload(row, event.target.files?.[0])}
                          />
                        </label>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
