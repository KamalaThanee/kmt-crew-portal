'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowLeft, ArrowUp, Bot, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { AI_USE_CASE_LABELS, AI_USE_CASES, type AiModel, type AiProvider, type AiUseCase } from '@/lib/aiModels'
import { readCurrentUser } from '@/lib/currentUser'
import { isAdminRole } from '@/lib/roles'

const adminHeaders = () => {
  const user = readCurrentUser()
  return {
    'Content-Type': 'application/json',
    'x-kmt-user-id': String(user?.id || ''),
    'x-kmt-pin': String(user?.pin || ''),
  }
}

export default function AiModelSettingsPage() {
  const router = useRouter()
  const [useCase, setUseCase] = useState<AiUseCase>('crew_certificate')
  const [models, setModels] = useState<AiModel[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState({ provider: 'google' as AiProvider, modelId: '', label: '' })

  const loadModels = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/ai-models?useCase=${useCase}`, {
        headers: adminHeaders(),
        cache: 'no-store',
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to load model settings')
      setModels(payload.models || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load model settings')
    } finally {
      setLoading(false)
    }
  }, [useCase])

  useEffect(() => {
    const user = readCurrentUser()
    if (!user || !isAdminRole(user.position)) {
      router.replace('/login')
      return
    }
    loadModels()
  }, [loadModels, router])

  const updateModel = (index: number, patch: Partial<AiModel>) => {
    setModels((current) => current.map((model, modelIndex) => modelIndex === index ? { ...model, ...patch } : model))
  }

  const moveModel = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= models.length) return
    setModels((current) => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const saveModels = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/admin/ai-models', {
        method: 'PATCH',
        headers: adminHeaders(),
        body: JSON.stringify({ models }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to save model settings')
      toast.success('AI model order updated')
      await loadModels()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save model settings')
    } finally {
      setSaving(false)
    }
  }

  const addModel = async () => {
    if (!draft.modelId.trim()) return toast.error('Model ID is required')
    setSaving(true)
    try {
      const response = await fetch('/api/admin/ai-models', {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ ...draft, useCase, priority: models.length + 1, enabled: true, freeTier: true }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to add model')
      setDraft({ provider: 'google', modelId: '', label: '' })
      toast.success('AI model added')
      await loadModels()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to add model')
    } finally {
      setSaving(false)
    }
  }

  const deleteModel = async (model: AiModel) => {
    if (!model.id || !confirm(`Delete ${model.label}?`)) return
    try {
      const response = await fetch(`/api/admin/ai-models?id=${model.id}`, { method: 'DELETE', headers: adminHeaders() })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to delete model')
      toast.success('AI model deleted')
      await loadModels()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete model')
    }
  }

  return (
    <main className="min-h-screen bg-black px-4 pb-32 pt-6 text-white md:px-10 md:pt-24">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/admin/dashboard')} className="rounded-2xl border border-white/10 bg-zinc-900 p-3 hover:border-orange-500"><ArrowLeft size={20}/></button>
            <div><h1 className="text-2xl font-black uppercase italic md:text-4xl">AI Model Settings</h1><p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Fallback order · API keys remain in server environment</p></div>
          </div>
          <Bot className="text-orange-500" size={34}/>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {AI_USE_CASES.map((item) => <button key={item} onClick={() => setUseCase(item)} className={`whitespace-nowrap rounded-2xl border px-4 py-3 text-[10px] font-black uppercase ${item === useCase ? 'border-orange-500 bg-orange-600 text-white' : 'border-white/10 bg-zinc-900 text-zinc-400'}`}>{AI_USE_CASE_LABELS[item]}</button>)}
        </div>

        <section className="rounded-[32px] border border-white/10 bg-zinc-950 p-4 md:p-7">
          <div className="mb-5"><h2 className="text-lg font-black uppercase">Fallback priority</h2><p className="text-xs normal-case text-zinc-500">The app tries enabled models from top to bottom.</p></div>
          {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-orange-500"/></div> : (
            <div className="space-y-3">
              {models.map((model, index) => (
                <div key={model.id || `${model.provider}-${model.modelId}`} className={`rounded-3xl border p-4 ${model.enabled ? 'border-white/10 bg-black' : 'border-white/5 bg-zinc-950 opacity-60'}`}>
                  <div className="grid gap-3 md:grid-cols-[60px_150px_1fr_1fr_auto] md:items-center">
                    <div className="flex items-center gap-1"><span className="w-6 text-center text-sm font-black text-orange-500">{index + 1}</span><div className="flex md:flex-col"><button onClick={() => moveModel(index, -1)} disabled={index === 0} className="p-1 disabled:opacity-20"><ArrowUp size={15}/></button><button onClick={() => moveModel(index, 1)} disabled={index === models.length - 1} className="p-1 disabled:opacity-20"><ArrowDown size={15}/></button></div></div>
                    <select value={model.provider} onChange={(event) => updateModel(index, { provider: event.target.value as AiProvider })} className="rounded-xl border border-white/10 bg-zinc-900 p-3 text-xs"><option value="google">Google AI Studio</option><option value="openrouter">OpenRouter</option></select>
                    <input value={model.modelId} onChange={(event) => updateModel(index, { modelId: event.target.value })} className="rounded-xl border border-white/10 bg-zinc-900 p-3 text-xs" placeholder="Model ID"/>
                    <input value={model.label} onChange={(event) => updateModel(index, { label: event.target.value })} className="rounded-xl border border-white/10 bg-zinc-900 p-3 text-xs" placeholder="Display name"/>
                    <button onClick={() => deleteModel(model)} className="rounded-xl p-3 text-red-400 hover:bg-red-500/10"><Trash2 size={17}/></button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-5 text-[10px] font-black uppercase text-zinc-400">
                    <label className="flex items-center gap-2"><input type="checkbox" checked={model.enabled} onChange={(event) => updateModel(index, { enabled: event.target.checked })}/> Enabled</label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={model.freeTier} onChange={(event) => updateModel(index, { freeTier: event.target.checked })}/> Free quota</label>
                  </div>
                </div>
              ))}
              <button onClick={saveModels} disabled={saving || models.length === 0} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 py-4 text-xs font-black uppercase disabled:opacity-40"><Save size={17}/>{saving ? 'Saving...' : 'Save order and settings'}</button>
            </div>
          )}
        </section>

        <section className="rounded-[32px] border border-orange-500/20 bg-orange-500/5 p-5 md:p-7">
          <h2 className="mb-4 text-sm font-black uppercase text-orange-400">Add model to {AI_USE_CASE_LABELS[useCase]}</h2>
          <div className="grid gap-3 md:grid-cols-[170px_1fr_1fr_auto]">
            <select value={draft.provider} onChange={(event) => setDraft({ ...draft, provider: event.target.value as AiProvider })} className="rounded-xl border border-white/10 bg-black p-3 text-xs"><option value="google">Google AI Studio</option><option value="openrouter">OpenRouter</option></select>
            <input value={draft.modelId} onChange={(event) => setDraft({ ...draft, modelId: event.target.value })} className="rounded-xl border border-white/10 bg-black p-3 text-xs" placeholder="Exact model ID"/>
            <input value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} className="rounded-xl border border-white/10 bg-black p-3 text-xs" placeholder="Display name (optional)"/>
            <button onClick={addModel} disabled={saving} className="flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-xs font-black uppercase text-black disabled:opacity-40"><Plus size={17}/>Add</button>
          </div>
        </section>
      </div>
    </main>
  )
}
