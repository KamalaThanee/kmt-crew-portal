'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, ArrowLeft, CalendarRange, Edit3, Loader2, Plus, Save, X } from 'lucide-react'
import { toast } from 'sonner'
import { readCurrentUser } from '@/lib/currentUser'
import { isAdminRole } from '@/lib/roles'

const POSITIONS = ['Safety Officer', 'Chief Officer', 'Chief Engineer'] as const

type Position = (typeof POSITIONS)[number]

type ReportDefinition = {
  id: string
  definition_key: string
  form_no: string
  details: string
  period: string | null
  pic: string
  sort_order: number
  effective_from_month: string
  created_by: string | null
  updated_by: string | null
}

type Draft = {
  id?: string
  formNo: string
  details: string
  period: string
  positions: Position[]
  sortOrder: number
}

const emptyDraft = (): Draft => ({
  formNo: '',
  details: '',
  period: 'Within on 30th of each month',
  positions: ['Safety Officer'],
  sortOrder: 0,
})

const nextMonthValue = () => {
  const date = new Date()
  date.setDate(1)
  date.setMonth(date.getMonth() + 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const adminHeaders = () => {
  const user = readCurrentUser()
  return {
    'Content-Type': 'application/json',
    'x-kmt-user-id': String(user?.id || ''),
    'x-kmt-pin': String(user?.pin || ''),
  }
}

const splitPositions = (value: string) => value.split('/').map((role) => role.trim()).filter(Boolean)

export default function MonthlyReportSettingsPage() {
  const router = useRouter()
  const [definitions, setDefinitions] = useState<ReportDefinition[]>([])
  const [effectiveMonth, setEffectiveMonth] = useState(nextMonthValue())
  const [draft, setDraft] = useState<Draft | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadDefinitions = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/monthly-report-master', {
        headers: adminHeaders(),
        cache: 'no-store',
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to load Monthly Report setup')
      setDefinitions(payload.definitions || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load Monthly Report setup')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const user = readCurrentUser()
    if (!user || !isAdminRole(user.position)) {
      router.replace('/login')
      return
    }
    loadDefinitions()
  }, [loadDefinitions, router])

  const openEdit = (definition: ReportDefinition) => {
    setDraft({
      id: definition.id,
      formNo: definition.form_no,
      details: definition.details,
      period: definition.period || '',
      positions: POSITIONS.filter((position) => splitPositions(definition.pic).includes(position)),
      sortOrder: definition.sort_order,
    })
  }

  const togglePosition = (position: Position) => {
    if (!draft) return
    setDraft({
      ...draft,
      positions: draft.positions.includes(position)
        ? draft.positions.filter((item) => item !== position)
        : [...draft.positions, position],
    })
  }

  const saveDefinition = async () => {
    if (!draft) return
    if (!draft.details.trim()) return toast.error('Document name is required')
    if (draft.positions.length === 0) return toast.error('Select at least one responsible position')
    setSaving(true)
    try {
      const response = await fetch('/api/admin/monthly-report-master', {
        method: draft.id ? 'PATCH' : 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ ...draft, effectiveFrom: effectiveMonth }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to save document')
      toast.success(draft.id ? `Changes will apply from ${effectiveMonth}` : `Document added from ${effectiveMonth}`)
      setDraft(null)
      await loadDefinitions()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save document')
    } finally {
      setSaving(false)
    }
  }

  const archiveDefinition = async (definition: ReportDefinition) => {
    const message = `Stop requiring ${definition.form_no} - ${definition.details} from ${effectiveMonth}? Earlier submissions will remain available.`
    if (!confirm(message)) return
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/monthly-report-master?id=${encodeURIComponent(definition.id)}&effectiveFrom=${encodeURIComponent(effectiveMonth)}`, {
        method: 'DELETE',
        headers: adminHeaders(),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to archive document')
      toast.success(`Document will stop from ${effectiveMonth}`)
      await loadDefinitions()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to archive document')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-black px-4 pb-32 pt-6 text-white md:px-10 md:pt-24">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/admin/settings')} className="rounded-2xl border border-white/10 bg-zinc-900 p-3 hover:border-orange-500"><ArrowLeft size={20}/></button>
            <div>
              <h1 className="text-2xl font-black uppercase italic md:text-4xl">Monthly Report Setup</h1>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Add, assign, edit and archive monthly requirements</p>
            </div>
          </div>
          <CalendarRange className="text-orange-500" size={36}/>
        </header>

        <section className="grid gap-4 rounded-[32px] border border-orange-500/20 bg-orange-500/5 p-5 md:grid-cols-[1fr_260px_auto] md:items-end md:p-7">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-400">Changes take effect</p>
            <p className="mt-2 text-xs normal-case text-zinc-400">Choose the first month that will use the new requirement. Earlier months and uploaded files remain unchanged.</p>
          </div>
          <label className="space-y-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
            Effective month
            <input type="month" value={effectiveMonth} onChange={(event) => setEffectiveMonth(event.target.value)} className="h-12 w-full rounded-2xl border border-white/10 bg-black px-4 text-sm font-black text-white outline-none focus:border-orange-500" />
          </label>
          <button onClick={() => setDraft(emptyDraft())} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-orange-600 px-6 text-xs font-black uppercase hover:bg-orange-500"><Plus size={17}/>Add document</button>
        </section>

        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-zinc-950">
          {loading ? (
            <div className="flex min-h-64 items-center justify-center text-zinc-500"><Loader2 className="mr-3 animate-spin"/>Loading setup...</div>
          ) : definitions.length === 0 ? (
            <div className="flex min-h-64 items-center justify-center text-sm font-black uppercase tracking-widest text-zinc-600">No managed monthly documents</div>
          ) : (
            <div className="divide-y divide-white/10">
              {definitions.map((definition) => {
                const roles = splitPositions(definition.pic)
                return (
                  <article key={definition.id} className="grid gap-5 p-5 md:grid-cols-[110px_1fr_260px_auto] md:items-center md:p-6">
                    <div>
                      <p className="text-xl font-black text-orange-400">{definition.form_no}</p>
                      <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-zinc-600">Order {definition.sort_order}</p>
                    </div>
                    <div>
                      <h2 className="text-sm font-black uppercase">{definition.details}</h2>
                      <p className="mt-2 text-xs normal-case text-zinc-500">{definition.period || 'No due-date description'}</p>
                      {roles.length > 1 && <p className="mt-2 text-[9px] font-black uppercase tracking-widest text-blue-300">Shared file · one upload satisfies all assigned positions</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {roles.map((role) => <span key={role} className="rounded-full border border-orange-500/25 bg-orange-500/10 px-3 py-2 text-[9px] font-black uppercase text-orange-300">{role}</span>)}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(definition)} className="rounded-xl border border-white/10 p-3 text-blue-300 hover:border-blue-400 hover:bg-blue-500/10" title="Edit"><Edit3 size={17}/></button>
                      <button onClick={() => archiveDefinition(definition)} disabled={saving} className="rounded-xl border border-white/10 p-3 text-red-300 hover:border-red-400 hover:bg-red-500/10 disabled:opacity-40" title="Archive"><Archive size={17}/></button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {draft && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-xl">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[36px] border border-orange-500/25 bg-zinc-950 p-6 shadow-2xl md:p-9">
            <div className="mb-7 flex items-center justify-between">
              <div><h2 className="text-2xl font-black uppercase italic">{draft.id ? 'Edit document' : 'Add monthly document'}</h2><p className="mt-1 text-xs text-zinc-500">Effective from {effectiveMonth}</p></div>
              <button onClick={() => setDraft(null)} className="rounded-full bg-white/5 p-3 hover:bg-red-500"><X size={20}/></button>
            </div>

            <div className="grid gap-5 md:grid-cols-[170px_1fr]">
              <label className="space-y-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">Form No.
                <input value={draft.formNo} onChange={(event) => setDraft({ ...draft, formNo: event.target.value })} placeholder="11.96 or N/A" className="h-12 w-full rounded-2xl border border-white/10 bg-black px-4 text-sm font-bold text-white outline-none focus:border-orange-500" />
              </label>
              <label className="space-y-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">Document name *
                <input value={draft.details} onChange={(event) => setDraft({ ...draft, details: event.target.value })} className="h-12 w-full rounded-2xl border border-white/10 bg-black px-4 text-sm font-bold text-white outline-none focus:border-orange-500" />
              </label>
            </div>

            <label className="mt-5 block space-y-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">Due-date description
              <input value={draft.period} onChange={(event) => setDraft({ ...draft, period: event.target.value })} className="h-12 w-full rounded-2xl border border-white/10 bg-black px-4 text-sm font-bold text-white outline-none focus:border-orange-500" />
            </label>

            <div className="mt-6">
              <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Responsible position *</p>
              <div className="grid gap-3 md:grid-cols-3">
                {POSITIONS.map((position) => {
                  const checked = draft.positions.includes(position)
                  return <button key={position} onClick={() => togglePosition(position)} className={`rounded-2xl border p-4 text-left text-xs font-black uppercase transition ${checked ? 'border-orange-500 bg-orange-600 text-white' : 'border-white/10 bg-black text-zinc-500 hover:border-orange-500/50'}`}><span className="mr-2 inline-block h-3 w-3 rounded-sm border border-current">{checked ? '✓' : ''}</span>{position}</button>
                })}
              </div>
              <p className="mt-3 text-[10px] normal-case text-zinc-500">Selecting more than one position creates a shared requirement: one uploaded file completes it for every selected position.</p>
            </div>

            <label className="mt-5 block max-w-[180px] space-y-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">Display order
              <input type="number" min="0" step="10" value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: Number(event.target.value) })} className="h-12 w-full rounded-2xl border border-white/10 bg-black px-4 text-sm font-bold text-white outline-none focus:border-orange-500" />
            </label>
            <p className="mt-2 text-[10px] normal-case text-blue-300">Display order applies immediately to every month. Other changes use the selected effective month.</p>

            <button onClick={saveDefinition} disabled={saving} className="mt-8 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 text-xs font-black uppercase hover:bg-orange-500 disabled:opacity-40">{saving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}Save document</button>
          </div>
        </div>
      )}
    </main>
  )
}
