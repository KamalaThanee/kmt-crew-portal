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
    setSaving(false)
  }

  const handleFiles = async (files: FileList | null, append = false) => {
    if (!files?.length) return
    setProcessingFiles(true)
    try {
      const fileArray = Array.from(files)
      const changeFile = fileArray.find(isChangeRecordFile) || null
      const uploadedDocs = fileArray.filter((file) => !isChangeRecordFile(file))
      const parsedChangeItems = changeFile ? await parseChangeRecord(changeFile) : []
      const combinedChangeItems = append && parsedChangeItems.length === 0 ? changeItems : parsedChangeItems
      const changeMap = new Map(combinedChangeItems.map((item) => [item.docNo.toLowerCase(), item]))
      const docMap = new Map(documents.map((doc) => [doc.doc_no.toLowerCase(), doc]))
      const roundFromFile = changeFile?.webkitRelativePath?.match(/Revision[_\s-]*(\d+)/i)?.[0] || changeFile?.name.match(/Revision[_\s-]*(\d+)/i)?.[0] || ''
      if (roundFromFile) setUpdateRound(roundFromFile.replace(/[_-]+/g, ' '))

      const nextDrafts: SmsFileDraft[] = []
      for (const file of uploadedDocs) {
        const header = await readSmsDocumentHeader(file)
        const docNo = header.docNo || ''
        const changeItem = changeMap.get(docNo.toLowerCase())
        const matchedDocument = docMap.get(docNo.toLowerCase())
        const category = getSmsCategoryFromPath(file) || changeItem?.category || (docNo.toLowerCase().startsWith('procedure') ? 'Procedure' : 'Checklist')
        const matchStatus: SmsFileDraft['matchStatus'] = !docNo
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
          source: header.source,
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

  const requiredMissing = useMemo(() => {
    const uploaded = new Set(drafts.map((draft) => draft.docNo.toLowerCase()).filter(Boolean))
    return changeItems.filter((item) => !uploaded.has(item.docNo.toLowerCase()))
  }, [changeItems, drafts])

  const confirmUpload = async () => {
    if (!isAdmin || !user) return toast.error('Admin permission required')
    const validDrafts = drafts.filter((draft) => draft.docNo && draft.title && draft.revision)
    if (validDrafts.length === 0) return toast.error('No valid SMS documents to upload')

    setSaving(true)
    try {
      for (const draft of validDrafts) {
        const existing = documents.find((doc) => doc.doc_no.toLowerCase() === draft.docNo.toLowerCase())
        let documentId = existing?.id || ''
        let oldRevision = existing?.current_revision || null

        if (!documentId) {
          const { data: newDoc, error: docError } = await supabase
            .from('sms_documents')
            .insert({
              doc_no: draft.docNo,
              title: draft.title,
              category: draft.category,
              current_revision: draft.revision,
              effective_date: draft.effectiveDate || null,
            })
            .select('id')
            .single()
          if (docError) throw docError
          documentId = newDoc.id
          oldRevision = null
        } else {
          await supabase.from('sms_document_versions').update({ status: 'superseded' }).eq('document_id', documentId).eq('status', 'active')
        }

        const filePath = buildSmsFilePath(draft.file, draft)
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
            file_name: draft.fileName,
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
          file_name: draft.fileName,
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
      .select('file_url')
      .eq('id', doc.active_version_id)
      .maybeSingle()
    if (error || !data?.file_url) return toast.error(error?.message || 'No file URL found')
    window.open(data.file_url, '_blank', 'noopener,noreferrer')
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
                    <Download size={15} className="mr-2 inline" /> Open / Download
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
