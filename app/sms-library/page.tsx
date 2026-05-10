'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Download, FileText, Loader2, Search, UploadCloud, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { readCurrentUser, type CurrentUser } from '@/lib/currentUser'
import { isAdminRole } from '@/lib/roles'
import {
  buildSmsFilePath,
  getSmsCategoryFromPath,
  isChangeRecordFile,
  parseChangeRecord,
  readSmsDocumentHeader,
  type SmsCategory,
  type SmsChangeRecordItem,
  type SmsDocument,
  type SmsFileDraft,
  type SmsRevisionLog,
  type SmsUploadInputProps,
} from '@/lib/smsDocuments'

const SMS_BUCKET = 'sms-documents'
const tabs: Array<SmsCategory | 'Revision Log'> = ['Procedure', 'Checklist', 'Revision Log']

const smsHeaderAiModels = [
  { id: 'gemini-3.1-flash-lite-preview', provider: 'google', label: 'Gemini 3.1 Flash Lite Preview' },
  { id: 'gemini-2.5-flash', provider: 'google', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-3-flash-preview', provider: 'google', label: 'Gemini 3 Flash Preview' },
  { id: 'google/gemini-2.5-flash-lite', provider: 'openrouter', label: 'Gemini 2.5 Flash Lite' },
  { id: 'qwen/qwen3-vl-32b-instruct', provider: 'openrouter', label: 'Qwen3 VL 32B' },
]

const formatDate = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

const statusStyles: Record<SmsFileDraft['matchStatus'], string> = {
  matched: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  new: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  'need-review': 'border-red-500/30 bg-red-500/10 text-red-300',
  extra: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
}

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onloadend = () => resolve(String(reader.result || ''))
  })

const normalizeKey = (value: string) => String(value || '').toLowerCase().replace(/[^a-z0-9.]+/g, '')

const getDocNoFromFileName = (fileName: string, category: SmsCategory) => {
  const base = fileName.replace(/\.[^.]+$/, '')
  const procedure = base.match(/\bprocedure\s+([0-9]+(?:\.[0-9]+)*)/i)
  if (category === 'Procedure' && procedure) return `procedure${procedure[1]}`
  const checklist = base.match(/\b(?:form\s+)?([0-9]{1,2}\.[0-9A-Za-z]+)\b/i)
  if (checklist) return checklist[1].toLowerCase()
  return ''
}

const isSuspiciousRevision = (revision: string) => {
  const value = String(revision || '').trim().toLowerCase()
  return !value || value === 'rev.00' || value === 'rev.0'
}

const isValidSmsDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false
  const date = new Date(`${value}T00:00:00`)
  return !Number.isNaN(date.getTime()) && date.getFullYear() >= 2000 && date.getFullYear() <= 2100
}

const isLegacyWordDoc = (file: File) => /\.doc$/i.test(file.name) && !/\.docx$/i.test(file.name)

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
const docKey = (value: string) => String(value || '').trim().toLowerCase()

export default function SmsLibraryPage() {
  const router = useRouter()
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [activeTab, setActiveTab] = useState<SmsCategory | 'Revision Log'>('Procedure')
  const [documents, setDocuments] = useState<SmsDocument[]>([])
  const [logs, setLogs] = useState<SmsRevisionLog[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [processingFiles, setProcessingFiles] = useState(false)
  const [aiReading, setAiReading] = useState(false)
  const [aiReadMessage, setAiReadMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [changeRecordFile, setChangeRecordFile] = useState<File | null>(null)
  const [changeItems, setChangeItems] = useState<SmsChangeRecordItem[]>([])
  const [drafts, setDrafts] = useState<SmsFileDraft[]>([])
  const [updateRound, setUpdateRound] = useState('')
  const [updateDate, setUpdateDate] = useState(new Date().toISOString().slice(0, 10))

  const isAdmin = isAdminRole(user?.position)
  const isFirstUpload = documents.length === 0
  const uploadActionLabel = isFirstUpload ? 'New Upload' : 'Upload Revision'

  useEffect(() => {
    const current = readCurrentUser()
    if (!current) {
      router.push('/login')
      return
    }
    setUser(current)
    fetchData()
  }, [router])

  const fetchData = async () => {
    setLoading(true)
    const [docRes, logRes] = await Promise.all([
      supabase
        .from('sms_documents')
        .select('id, doc_no, title, category, current_revision, effective_date, active_version_id, status, updated_at')
        .eq('status', 'active')
        .order('doc_no'),
      supabase
        .from('sms_revision_logs')
        .select('id, action, doc_no, title, category, old_revision, new_revision, file_name, actor_name, details, update_round, update_date, created_at')
        .order('created_at', { ascending: false })
        .limit(100),
    ])

    if (docRes.error) {
      toast.error(`${docRes.error.message}. Run sql/sms_library.sql first.`)
      setDocuments([])
    } else {
      setDocuments((docRes.data || []) as SmsDocument[])
    }

    if (!logRes.error) setLogs((logRes.data || []) as SmsRevisionLog[])
    setLoading(false)
  }

  const visibleDocuments = useMemo(() => {
    if (activeTab === 'Revision Log') return []
    const q = search.toLowerCase().trim()
    return documents
      .filter((doc) => doc.category === activeTab)
      .filter((doc) => !q || `${doc.doc_no} ${doc.title} ${doc.current_revision || ''}`.toLowerCase().includes(q))
      .sort((a, b) => collator.compare(a.doc_no, b.doc_no))
  }, [activeTab, documents, search])

  const visibleLogs = useMemo(() => {
    const q = search.toLowerCase().trim()
    return logs.filter((log) => !q || `${log.doc_no || ''} ${log.title || ''} ${log.action || ''} ${log.actor_name || ''}`.toLowerCase().includes(q))
  }, [logs, search])

  const resetUpload = () => {
    setUploadOpen(false)
    setDrafts([])
    setChangeItems([])
    setChangeRecordFile(null)
    setUpdateRound('')
    setUpdateDate(new Date().toISOString().slice(0, 10))
    setProcessingFiles(false)
    setAiReading(false)
    setAiReadMessage('')
    setSaving(false)
  }

  const handleFiles = async (files: FileList | null, append = false) => {
    if (!files?.length) return
    setProcessingFiles(true)
    try {
      const fileArray = Array.from(files)
      const legacyWordCount = fileArray.filter((file) => !isChangeRecordFile(file) && isLegacyWordDoc(file)).length
      if (legacyWordCount > 0) {
        toast.warning(`${legacyWordCount} legacy Word .doc files detected. Convert to .docx first for accurate header reading.`)
      }
      const changeFile = fileArray.find(isChangeRecordFile) || null
      const uploadedDocs = fileArray.filter((file) => !isChangeRecordFile(file))
      const parsedChangeItems = changeFile ? await parseChangeRecord(changeFile) : []
      const combinedChangeItems = append && parsedChangeItems.length === 0 ? changeItems : parsedChangeItems
      const changeMap = new Map(combinedChangeItems.map((item) => [docKey(item.docNo), item]))
      const docMap = new Map(documents.map((doc) => [docKey(doc.doc_no), doc]))
      const roundFromFile = changeFile?.webkitRelativePath?.match(/Revision[_\s-]*(\d+)/i)?.[0] || changeFile?.name.match(/Revision[_\s-]*(\d+)/i)?.[0] || ''
      const roundFromChangeRecord = parsedChangeItems.find((item) => item.roundRevision)?.roundRevision || ''
      if (roundFromChangeRecord) setUpdateRound(roundFromChangeRecord)
      else if (roundFromFile) setUpdateRound(roundFromFile.replace(/[_-]+/g, ' '))

      const nextDrafts: SmsFileDraft[] = []
      for (const file of uploadedDocs) {
        const isLegacyWord = isLegacyWordDoc(file)
        const header = await readSmsDocumentHeader(file)
        const docNo = header.docNo || ''
        const changeItem = changeMap.get(docKey(docNo))
        const matchedDocument = docMap.get(docKey(docNo))
        const category = getSmsCategoryFromPath(file) || changeItem?.category || (docNo.toLowerCase().startsWith('procedure') ? 'Procedure' : 'Checklist')
        const matchStatus: SmsFileDraft['matchStatus'] = isLegacyWord
          ? 'need-review'
          : !docNo
          ? 'need-review'
          : matchedDocument
            ? 'matched'
            : changeItem
              ? 'new'
              : 'extra'

        nextDrafts.push({
          id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
          file,
          fileName: file.name,
          docNo,
          title: header.title || changeItem?.title || file.name.replace(/\.[^.]+$/, ''),
          category,
          revision: header.revision || changeItem?.revision || '',
          effectiveDate: header.effectiveDate || '',
          changeSummary: changeItem?.changeSummary || '',
          source: isLegacyWord ? 'Legacy Word .doc · Filename only · review before save' : header.source,
          extractedText: header.extractedText || '',
          matchStatus,
          matchedDocumentId: matchedDocument?.id,
          oldRevision: matchedDocument?.current_revision || null,
        })
      }

      if (changeFile) setChangeRecordFile(changeFile)
      if (parsedChangeItems.length > 0) setChangeItems(parsedChangeItems)
      else if (!append) setChangeItems([])
      setDrafts((prev) => append ? [...prev, ...nextDrafts] : nextDrafts)
      if (changeFile) toast.success(`Change record found: ${parsedChangeItems.length} required documents`)
      else if (!append) toast.warning('No Change record file found in this upload set')
      else toast.success(`Added ${nextDrafts.length} files to current upload set`)
    } catch (error: any) {
      toast.error(error?.message || 'Unable to process SMS files')
    } finally {
      setProcessingFiles(false)
    }
  }

  const updateDraft = (id: string, field: 'docNo' | 'title' | 'revision' | 'effectiveDate' | 'category', value: string) => {
    setDrafts((prev) => prev.map((draft) => {
      if (draft.id !== id) return draft
      if (field === 'category') return { ...draft, category: value === 'Procedure' ? 'Procedure' : 'Checklist' }
      return { ...draft, [field]: value }
    }))
  }

  const shouldAiReadDraft = (draft: SmsFileDraft) => {
    const expectedDocNo = getDocNoFromFileName(draft.fileName, draft.category)
    const docNoLooksRight = !expectedDocNo || normalizeKey(draft.docNo) === expectedDocNo
    const hasUsableTitle = draft.title.trim().length >= 4 && !/^untitled|document$/i.test(draft.title.trim())
    const hasReliableRevision = !isSuspiciousRevision(draft.revision)
    const hasReliableDate = isValidSmsDate(draft.effectiveDate)
    const parserLooksReliable = docNoLooksRight && hasUsableTitle && hasReliableRevision && hasReliableDate && draft.source !== 'Filename'

    return !parserLooksReliable
  }

  const runSmsHeaderAi = async () => {
    const targets = drafts.filter(shouldAiReadDraft)
    if (targets.length === 0) return toast.success('All preview rows passed parser validation. No AI needed.')
    setAiReading(true)
    setAiReadMessage('Preparing AI header read...')

    const nextDrafts = [...drafts]
    try {
      for (let index = 0; index < targets.length; index += 1) {
        const draft = targets[index]
        const draftIndex = nextDrafts.findIndex((item) => item.id === draft.id)
        if (draftIndex < 0) continue

        const isPdf = draft.file.type === 'application/pdf' || draft.fileName.toLowerCase().endsWith('.pdf')
        let fileBase64 = ''
        let mimeType = ''
        let pageNumber = draft.category === 'Procedure' ? 2 : 1

        if (isPdf) {
          setAiReadMessage(`AI reading ${draft.fileName} page ${pageNumber} (${index + 1}/${targets.length})`)
          fileBase64 = await readFileAsDataUrl(draft.file)
          mimeType = 'application/pdf'
        } else {
          setAiReadMessage(`AI structuring ${draft.fileName} header text (${index + 1}/${targets.length})`)
        }

        const modelErrors: string[] = []
        for (const model of smsHeaderAiModels) {
          try {
            const res = await fetch('/api/sms-header-ai', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileBase64: isPdf ? fileBase64 : '',
                mimeType: isPdf ? mimeType : '',
                extractedText: isPdf ? '' : draft.extractedText || '',
                fileName: draft.fileName,
                category: draft.category,
                pageNumber,
                modelId: model.id,
                provider: model.provider,
              }),
            })
            const result = await res.json()
            if (!res.ok || result.error) throw new Error(result.error || 'AI header read failed')

            nextDrafts[draftIndex] = {
              ...nextDrafts[draftIndex],
              docNo: result.docNo || nextDrafts[draftIndex].docNo,
              title: result.title || nextDrafts[draftIndex].title,
              revision: result.revision || nextDrafts[draftIndex].revision,
              effectiveDate: result.effectiveDate || nextDrafts[draftIndex].effectiveDate,
              source: `${isPdf ? `AI Vision page ${pageNumber}` : 'AI text header'} · ${model.label}${result.needsReview ? ' · review' : ''}`,
              matchStatus: result.needsReview ? 'need-review' : nextDrafts[draftIndex].matchStatus,
            }
            setDrafts([...nextDrafts])
            break
          } catch (error: any) {
            modelErrors.push(`${model.label}: ${error?.message || 'failed'}`)
            if (model === smsHeaderAiModels[smsHeaderAiModels.length - 1]) {
              nextDrafts[draftIndex] = {
                ...nextDrafts[draftIndex],
                source: `${nextDrafts[draftIndex].source} · AI failed`,
                matchStatus: 'need-review',
              }
            }
          }
        }
      }

      setDrafts(nextDrafts)
      setAiReadMessage('AI header read completed. Please review before save.')
      toast.success('AI header read completed')
    } catch (error: any) {
      setAiReadMessage(error?.message || 'AI header read failed')
      toast.error(error?.message || 'AI header read failed')
    } finally {
      setAiReading(false)
    }
  }

  const requiredMissing = useMemo(() => {
    const uploaded = new Set(drafts.map((draft) => docKey(draft.docNo)).filter(Boolean))
    return changeItems.filter((item) => !uploaded.has(docKey(item.docNo)))
  }, [changeItems, drafts])

  const changeRecordChecklist = useMemo(() => {
    const uploaded = new Set(drafts.map((draft) => docKey(draft.docNo)).filter(Boolean))
    return changeItems.map((item) => ({
      ...item,
      found: uploaded.has(docKey(item.docNo)),
      currentRevision: documents.find((doc) => docKey(doc.doc_no) === docKey(item.docNo))?.current_revision || '',
    }))
  }, [changeItems, documents, drafts])

  const confirmUpload = async () => {
    if (!isAdmin || !user) return toast.error('Admin permission required')
    const validDrafts = drafts.filter((draft) => draft.docNo && draft.title && draft.revision)
    if (validDrafts.length === 0) return toast.error('No valid SMS documents to upload')
    const knownRevisions = new Map<string, string>()
    validDrafts.forEach((draft) => {
      if (draft.oldRevision) knownRevisions.set(draft.docNo, draft.oldRevision)
    })
    const docNosToCheck = Array.from(new Set(validDrafts.map((draft) => draft.docNo)))
    const { data: existingRows, error: existingRowsError } = await supabase
      .from('sms_documents')
      .select('doc_no, current_revision')
      .in('doc_no', docNosToCheck)

    if (existingRowsError) return toast.error(existingRowsError.message)
    ;((existingRows || []) as Array<{ doc_no?: string | null; current_revision?: string | null }>).forEach((row) => {
      if (row.doc_no && row.current_revision) knownRevisions.set(row.doc_no, row.current_revision)
    })

    const replacingItems = validDrafts
      .map((draft) => ({ draft, oldRevision: knownRevisions.get(draft.docNo) || '' }))
      .filter((item) => item.oldRevision)
    if (replacingItems.length > 0) {
      const sample = replacingItems
        .slice(0, 5)
        .map(({ draft, oldRevision }) => `${draft.docNo}: ${oldRevision} -> ${draft.revision}`)
        .join('\n')
      const extra = replacingItems.length > 5 ? `\n...and ${replacingItems.length - 5} more` : ''
      const ok = window.confirm(`This upload will replace ${replacingItems.length} existing SMS document(s):\n\n${sample}${extra}\n\nContinue and supersede the old revision?`)
      if (!ok) return
    }

    setSaving(true)
    try {
      for (const draft of validDrafts) {
        const existing = documents.find((doc) => doc.doc_no.toLowerCase() === draft.docNo.toLowerCase())
        let documentId = existing?.id || ''
        let oldRevision = existing?.current_revision || null

        if (!documentId) {
          const { data: dbExisting, error: dbExistingError } = await supabase
            .from('sms_documents')
            .select('id, current_revision')
            .eq('doc_no', draft.docNo)
            .maybeSingle()
          if (dbExistingError) throw dbExistingError

          const dbExistingDoc = dbExisting as { id?: string; current_revision?: string | null } | null
          if (dbExistingDoc?.id) {
            documentId = dbExistingDoc.id
            oldRevision = dbExistingDoc.current_revision || null
          }
        }

        if (!documentId) {
          const { data: newDoc, error: docError } = await supabase
            .from('sms_documents')
            .insert({
              doc_no: draft.docNo,
              title: draft.title,
              category: draft.category,
              current_revision: draft.revision,
              effective_date: draft.effectiveDate || null,
              status: 'active',
              updated_at: new Date().toISOString(),
            })
            .select('id')
            .single()
          if (docError) throw docError
          const createdDoc = newDoc as { id: string }
          documentId = createdDoc.id
          oldRevision = null
        }
        await supabase.from('sms_document_versions').update({ status: 'superseded' }).eq('document_id', documentId).eq('status', 'active')

        const filePath = buildSmsFilePath(draft.file, draft)
        const storedFileName = filePath.split('/').pop() || draft.fileName
        const { error: uploadError } = await supabase.storage.from(SMS_BUCKET).upload(filePath, draft.file, { upsert: true })
        if (uploadError) throw uploadError
        const { data: publicData } = supabase.storage.from(SMS_BUCKET).getPublicUrl(filePath)

        const { data: version, error: versionError } = await supabase
          .from('sms_document_versions')
          .insert({
            document_id: documentId,
            doc_no: draft.docNo,
            title: draft.title,
            category: draft.category,
            revision: draft.revision,
            effective_date: draft.effectiveDate || null,
            status: 'active',
            file_name: storedFileName,
            file_path: filePath,
            file_url: publicData.publicUrl,
            file_size: draft.file.size,
            mime_type: draft.file.type || null,
            change_summary: draft.changeSummary || null,
            header_source: draft.source,
            update_round: updateRound || null,
            update_date: updateDate || null,
            uploaded_by: user.id,
            uploaded_by_name: user.full_name,
          })
          .select('id')
          .single()
        if (versionError) throw versionError

        await supabase
          .from('sms_documents')
          .update({
            title: draft.title,
            category: draft.category,
            current_revision: draft.revision,
            effective_date: draft.effectiveDate || null,
            active_version_id: version.id,
            status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', documentId)

        await supabase.from('sms_revision_logs').insert({
          document_id: documentId,
          version_id: version.id,
          action: oldRevision ? 'revised' : 'created',
          doc_no: draft.docNo,
          title: draft.title,
          category: draft.category,
          old_revision: oldRevision,
          new_revision: draft.revision,
          file_name: storedFileName,
          actor_id: user.id,
          actor_name: user.full_name,
          update_round: updateRound || null,
          update_date: updateDate || null,
          details: {
            matchStatus: draft.matchStatus,
            source: draft.source,
            effectiveDate: draft.effectiveDate || null,
            updateRound: updateRound || null,
            updateDate: updateDate || null,
            changeSummary: draft.changeSummary || null,
            changeRecordFile: changeRecordFile?.name || null,
          },
        })
      }

      toast.success(`SMS Library updated: ${validDrafts.length} files`)
      resetUpload()
      fetchData()
    } catch (error: any) {
      toast.error(error?.message || 'Unable to save SMS revision')
    } finally {
      setSaving(false)
    }
  }

  const openDocument = async (doc: SmsDocument) => {
    if (!doc.active_version_id) return toast.error('No active file attached')
    const { data, error } = await supabase
      .from('sms_document_versions')
      .select('file_url, file_name, mime_type')
      .eq('id', doc.active_version_id)
      .maybeSingle()
    const fileData = data as { file_url?: string | null; file_name?: string | null; mime_type?: string | null } | null
    if (error || !fileData?.file_url) return toast.error(error?.message || 'No file URL found')
    const fileUrl = String(fileData.file_url)
    const fileName = String(fileData.file_name || fileUrl).split('?')[0]
    const ext = fileName.split('.').pop()?.toLowerCase() || ''
    const officeExts = new Set(['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'])
    const previewUrl = officeExts.has(ext)
      ? `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(fileUrl)}`
      : fileUrl

    window.open(previewUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="min-h-screen bg-[#02030b] px-4 pb-28 pt-28 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <section className="mb-10 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-3 text-orange-500">
              <FileText size={38} />
              <h1 className="text-4xl font-black italic uppercase tracking-tight md:text-5xl">SMS Library</h1>
            </div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-zinc-500">Controlled procedure and checklist documents</p>
          </div>

          <div className="flex flex-col gap-3 md:items-end">
            <div className="grid rounded-[28px] border border-orange-500/25 bg-black/70 p-2 md:grid-cols-3">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-[22px] px-6 py-4 text-xs font-black uppercase transition-all ${activeTab === tab ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/25' : 'text-zinc-500 hover:text-orange-300'}`}
                >
                  {tab}
                </button>
              ))}
            </div>
            {isAdmin && (
              <button onClick={() => setUploadOpen(true)} className="rounded-[24px] bg-orange-600 px-6 py-4 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-orange-600/20">
                <UploadCloud size={16} className="mr-2 inline" /> {uploadActionLabel}
              </button>
            )}
          </div>
        </section>

        <div className="mb-8 flex items-center gap-3 rounded-[30px] border border-white/10 bg-zinc-950 p-4">
          <Search size={18} className="text-orange-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search document no, title, revision..."
            className="w-full bg-transparent text-sm font-bold text-white outline-none placeholder:text-zinc-600"
          />
        </div>

        {loading ? (
          <div className="rounded-[36px] border border-white/10 bg-zinc-950 p-12 text-center text-sm font-black uppercase tracking-widest text-orange-400">Loading SMS Library...</div>
        ) : activeTab === 'Revision Log' ? (
          <div className="space-y-3">
            {visibleLogs.length === 0 ? (
              <div className="rounded-[36px] border border-white/10 bg-zinc-950 p-12 text-center text-sm font-black uppercase tracking-widest text-zinc-500">No revision log yet</div>
            ) : visibleLogs.map((log) => (
              <div key={log.id} className="rounded-[28px] border border-white/10 bg-zinc-950 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-orange-400">{log.action}</p>
                    <h3 className="mt-2 text-xl font-black italic uppercase">{log.doc_no} · {log.title}</h3>
                    <p className="mt-1 text-xs font-bold text-zinc-500">
                      {log.old_revision || '-'} -&gt; {log.new_revision || '-'} · {log.update_round || 'No update round'} · By {log.actor_name || 'Unknown'} · {formatDateTime(log.created_at)}
                    </p>
                  </div>
                  <span className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase text-zinc-300">{log.category}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {visibleDocuments.length === 0 ? (
              <div className="rounded-[36px] border border-white/10 bg-zinc-950 p-12 text-center text-sm font-black uppercase tracking-widest text-zinc-500">No {activeTab} documents yet</div>
            ) : visibleDocuments.map((doc) => (
              <div key={doc.id} className="rounded-[34px] border border-white/10 bg-zinc-950 p-6 transition hover:border-orange-500/35">
                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-400">{doc.doc_no}</p>
                    <h3 className="mt-2 text-2xl font-black italic uppercase">{doc.title}</h3>
                    <p className="mt-2 text-xs font-bold text-zinc-500">
                      Revision {doc.current_revision || '-'} · Effective {formatDate(doc.effective_date)}
                    </p>
                  </div>
                  <button onClick={() => openDocument(doc)} className="rounded-[22px] border border-blue-500/40 bg-blue-500/10 px-5 py-3 text-xs font-black uppercase text-blue-200 hover:bg-blue-500/20">
                    <Download size={15} className="mr-2 inline" /> Preview / Open
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {uploadOpen && (
        <div className="fixed inset-0 z-[2500] flex items-center justify-center bg-black/85 p-4 backdrop-blur-xl">
          <div className="w-full max-w-6xl overflow-hidden rounded-[42px] border border-orange-500/25 bg-zinc-950 shadow-2xl">
            <div className="flex items-start justify-between border-b border-white/10 p-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-400">SMS Revision Upload</p>
                <h2 className="mt-2 text-3xl font-black italic uppercase">{uploadActionLabel}</h2>
                <p className="mt-1 text-xs normal-case text-zinc-500">
                  {isFirstUpload
                    ? 'Upload the current SMS document set to create the first controlled library baseline.'
                    : 'Upload the new revision files together with 00_Change record. The app will detect and compare required documents.'}
                </p>
              </div>
              <button onClick={resetUpload} className="rounded-2xl bg-white/5 p-3 text-zinc-400 hover:text-white"><X size={20} /></button>
            </div>

            <div className="max-h-[78vh] space-y-5 overflow-y-auto p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block cursor-pointer rounded-[30px] border border-dashed border-orange-500/35 bg-orange-500/10 p-8 text-center">
                  <UploadCloud className="mx-auto mb-3 text-orange-400" size={30} />
                  <p className="text-sm font-black uppercase tracking-widest">Choose Files</p>
                  <p className="mt-1 text-xs normal-case text-zinc-500">Select multiple SMS files and 00_Change record.</p>
                  <input multiple type="file" className="hidden" onChange={(event) => handleFiles(event.target.files, false)} />
                </label>
                <label className="block cursor-pointer rounded-[30px] border border-dashed border-blue-500/35 bg-blue-500/10 p-8 text-center">
                  <UploadCloud className="mx-auto mb-3 text-blue-300" size={30} />
                  <p className="text-sm font-black uppercase tracking-widest">Choose Folder</p>
                  <p className="mt-1 text-xs normal-case text-zinc-500">Choose this again to add another folder into the same preview.</p>
                  <input
                    multiple
                    type="file"
                    className="hidden"
                    {...({ webkitdirectory: '', directory: '' } as SmsUploadInputProps)}
                    onChange={(event) => handleFiles(event.target.files, true)}
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[24px] border border-white/10 bg-black/35 p-4">
                  <label className="mb-2 block text-[9px] font-black uppercase tracking-[0.25em] text-zinc-500">Update round</label>
                  <input
                    value={updateRound}
                    onChange={(event) => setUpdateRound(event.target.value)}
                    placeholder={isFirstUpload ? 'Initial baseline / Revision 30' : 'Revision 30'}
                    className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm font-black text-white outline-none focus:border-orange-500"
                  />
                </div>
                <div className="rounded-[24px] border border-white/10 bg-black/35 p-4">
                  <label className="mb-2 block text-[9px] font-black uppercase tracking-[0.25em] text-zinc-500">Update date</label>
                  <input
                    type="date"
                    value={updateDate}
                    onChange={(event) => setUpdateDate(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm font-black text-white outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {processingFiles && (
                <div className="rounded-[28px] border border-white/10 bg-black/40 p-6 text-center text-sm font-black uppercase tracking-widest text-orange-400">
                  <Loader2 className="mr-2 inline animate-spin" size={18} /> Reading documents...
                </div>
              )}

              {drafts.length > 0 && (
                <div className="flex flex-col gap-3 rounded-[28px] border border-cyan-500/25 bg-cyan-500/10 p-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">AI Header Assist</p>
                    <p className="mt-1 text-xs normal-case text-zinc-400">
                      Procedure reads PDF page 2. Checklist reads page 1. AI fills only missing/uncertain header fields.
                    </p>
                    {aiReadMessage && <p className="mt-2 text-xs font-bold text-cyan-100">{aiReadMessage}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={runSmsHeaderAi}
                    disabled={aiReading || processingFiles}
                    className="rounded-[22px] border border-cyan-400/35 bg-cyan-500/15 px-5 py-3 text-xs font-black uppercase tracking-widest text-cyan-100 disabled:opacity-50"
                  >
                    {aiReading ? <Loader2 size={15} className="mr-2 inline animate-spin" /> : <UploadCloud size={15} className="mr-2 inline" />}
                    {aiReading ? 'AI Reading...' : 'AI Read Headers'}
                  </button>
                </div>
              )}

              {(changeRecordFile || drafts.length > 0) && (
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="rounded-[24px] border border-emerald-500/25 bg-emerald-500/10 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Change Record</p>
                    <p className="mt-2 text-lg font-black">{changeRecordFile ? 'Found' : 'Missing'}</p>
                  </div>
                  <div className="rounded-[24px] border border-blue-500/25 bg-blue-500/10 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-300">Required</p>
                    <p className="mt-2 text-lg font-black">{changeItems.length}</p>
                  </div>
                  <div className="rounded-[24px] border border-orange-500/25 bg-orange-500/10 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-orange-300">Uploaded Docs</p>
                    <p className="mt-2 text-lg font-black">{drafts.length}</p>
                  </div>
                  <div className="rounded-[24px] border border-red-500/25 bg-red-500/10 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-red-300">Missing</p>
                    <p className="mt-2 text-lg font-black">{requiredMissing.length}</p>
                  </div>
                </div>
              )}

              {requiredMissing.length > 0 && (
                <div className="rounded-[28px] border border-red-500/30 bg-red-500/10 p-5">
                  <p className="mb-3 text-xs font-black uppercase tracking-widest text-red-300"><AlertTriangle size={16} className="mr-2 inline" /> Missing from this upload set</p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {requiredMissing.slice(0, 10).map((item) => (
                      <div key={`${item.docNo}-${item.revision}`} className="rounded-xl bg-black/30 px-3 py-2 text-xs font-bold text-red-100">{item.docNo} · {item.title} · {item.revision}</div>
                    ))}
                  </div>
                </div>
              )}

              {changeRecordChecklist.length > 0 && (
                <div className="rounded-[30px] border border-white/10 bg-black/35 p-5">
                  <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-400">Revision checklist</p>
                      <h3 className="mt-2 text-2xl font-black italic uppercase">{changeRecordChecklist[0]?.roundRevision || updateRound || 'Current revision'}</h3>
                    </div>
                    <p className="text-xs font-bold text-zinc-500">
                      {changeRecordChecklist.filter((item) => item.found).length} / {changeRecordChecklist.length} uploaded
                    </p>
                  </div>
                  <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
                    {changeRecordChecklist.map((item) => (
                      <div
                        key={`${item.docNo}-${item.revision}-${item.title}`}
                        className={`grid gap-3 rounded-2xl border px-4 py-3 text-xs md:grid-cols-[34px_130px_1fr_120px] ${
                          item.found ? 'border-emerald-500/25 bg-emerald-500/10' : 'border-red-500/25 bg-red-500/10'
                        }`}
                      >
                        <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${item.found ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                          {item.found ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                        </span>
                        <div>
                          <p className="font-black text-white">{item.docNo}</p>
                          <p className="mt-1 text-[10px] font-black uppercase text-zinc-500">Current {item.currentRevision || '-'}</p>
                        </div>
                        <div>
                          <p className="font-black uppercase text-white">{item.title}</p>
                          <p className="mt-1 text-[10px] text-zinc-400">{item.changeSummary || 'No change summary'}</p>
                        </div>
                        <div className="text-right md:text-left">
                          <p className="font-black text-orange-200">{item.revision}</p>
                          <p className={`mt-1 text-[10px] font-black uppercase ${item.found ? 'text-emerald-300' : 'text-red-300'}`}>
                            {item.found ? 'Found' : 'Missing'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {drafts.length > 0 && (
                <div className="overflow-hidden rounded-[30px] border border-white/10">
                  <div className="grid grid-cols-[1.1fr_130px_140px_1.4fr_100px_130px_120px] gap-3 border-b border-white/10 bg-white/5 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    <span>File</span><span>Doc No.</span><span>Category</span><span>Title</span><span>Revision</span><span>Effective</span><span>Status</span>
                  </div>
                  <div className="max-h-[360px] overflow-y-auto">
                    {drafts.map((draft) => (
                      <div key={draft.id} className="grid grid-cols-[1.1fr_130px_140px_1.4fr_100px_130px_120px] gap-3 border-b border-white/5 px-4 py-3 text-xs">
                        <div>
                          <p className="font-black text-white">{draft.fileName}</p>
                          <p className="mt-1 text-[10px] text-zinc-500">{draft.source}</p>
                          {draft.oldRevision && (
                            <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-amber-300">
                              Replacing {draft.oldRevision}
                            </p>
                          )}
                        </div>
                        <input value={draft.docNo} onChange={(event) => updateDraft(draft.id, 'docNo', event.target.value)} className="rounded-xl border border-white/10 bg-black px-3 py-2 font-bold text-white outline-none focus:border-orange-500" />
                        <select value={draft.category} onChange={(event) => updateDraft(draft.id, 'category', event.target.value)} className="rounded-xl border border-white/10 bg-black px-3 py-2 font-bold text-white outline-none focus:border-orange-500">
                          <option value="Procedure">Procedure</option>
                          <option value="Checklist">Checklist</option>
                        </select>
                        <input value={draft.title} onChange={(event) => updateDraft(draft.id, 'title', event.target.value)} className="rounded-xl border border-white/10 bg-black px-3 py-2 font-bold text-white outline-none focus:border-orange-500" />
                        <input value={draft.revision} onChange={(event) => updateDraft(draft.id, 'revision', event.target.value)} className="rounded-xl border border-white/10 bg-black px-3 py-2 font-bold text-white outline-none focus:border-orange-500" />
                        <input type="date" value={draft.effectiveDate} onChange={(event) => updateDraft(draft.id, 'effectiveDate', event.target.value)} className="rounded-xl border border-white/10 bg-black px-3 py-2 font-bold text-white outline-none focus:border-orange-500" />
                        <span className={`flex items-center justify-center rounded-xl border px-3 py-2 text-[9px] font-black uppercase ${statusStyles[draft.matchStatus]}`}>
                          {draft.matchStatus}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3 md:flex-row md:justify-end">
                <button onClick={resetUpload} className="rounded-[22px] bg-white/5 px-6 py-4 text-xs font-black uppercase text-zinc-300">Cancel</button>
                <button onClick={confirmUpload} disabled={saving || processingFiles || drafts.length === 0} className="rounded-[22px] bg-orange-600 px-6 py-4 text-xs font-black uppercase text-white shadow-lg shadow-orange-600/20 disabled:opacity-50">
                  {saving ? <Loader2 size={16} className="mr-2 inline animate-spin" /> : <CheckCircle2 size={16} className="mr-2 inline" />}
                  Confirm Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
