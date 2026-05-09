'use client'

import { useEffect, useState } from 'react'
import { Ruler, Save, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

const uniqueSorted = (values: string[]) =>
  [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

type PpeSizeUpdateModalProps = {
  user: any
  onClose: () => void
  onSaved: (nextUser: any) => void
}

export function PpeSizeUpdateModal({ user, onClose, onSaved }: PpeSizeUpdateModalProps) {
  const [activeWindow, setActiveWindow] = useState<any>(null)
  const [inventory, setInventory] = useState<any[]>([])
  const [sizeCharts, setSizeCharts] = useState({ suit: '', boot: '' })
  const [form, setForm] = useState({
    suit_color: user.suit_color || '',
    suit_size: user.suit_size || '',
    boot_size: user.boot_size || '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      const [windowRes, inventoryRes, settingsRes] = await Promise.all([
        supabase
          .from('ppe_size_windows')
          .select('id, title, deadline_at')
          .eq('status', 'open')
          .order('opened_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('ppe_inventory').select('item_name, color, size'),
        supabase.from('ppe_settings').select('suit_chart_url, boot_url').eq('id', 1).maybeSingle(),
      ])

      if (!windowRes.error) setActiveWindow(windowRes.data || null)
      if (!inventoryRes.error) setInventory(inventoryRes.data || [])
      if (!settingsRes.error && settingsRes.data) {
        setSizeCharts({
          suit: settingsRes.data.suit_chart_url || '',
          boot: settingsRes.data.boot_url || '',
        })
      }
      setLoading(false)
    }
    load()
  }, [])

  const suitInventory = inventory.filter((item) => String(item.item_name || '').toLowerCase().includes('suit'))
  const bootInventory = inventory.filter((item) => {
    const name = String(item.item_name || '').toLowerCase()
    return name.includes('safety boot') && !name.includes('rubber')
  })
  const suitColorOptions = uniqueSorted(suitInventory.map((item) => String(item.color || '').trim()))
  const suitSizeOptions = uniqueSorted(suitInventory.map((item) => String(item.size || '').trim()))
  const bootSizeOptions = uniqueSorted(bootInventory.map((item) => String(item.size || '').trim()))
  const sizeWindowConfirmed = activeWindow?.id && String(user?.ppe_size_confirmed_window_id || '') === String(activeWindow.id)

  const save = async () => {
    if (!activeWindow?.id) return toast.error('No active PPE size update window')
    if (!form.suit_color || !form.suit_size || !form.boot_size) {
      return toast.error('Please select boiler suit color, suit size, and safety boots size')
    }

    setSaving(true)
    const confirmedAt = new Date().toISOString()
    const profilePayload = {
      suit_color: form.suit_color,
      suit_size: form.suit_size,
      boot_size: form.boot_size,
      ppe_size_confirmed_at: confirmedAt,
      ppe_size_confirmed_window_id: activeWindow.id,
    }
    const { error } = await supabase.from('crews').update(profilePayload).eq('id', user.id)
    if (error) {
      setSaving(false)
      return toast.error(`${error.message}. Run sql/ppe_size_update_window.sql first.`)
    }

    await supabase.from('ppe_size_responses').upsert({
      window_id: activeWindow.id,
      crew_id: user.id,
      crew_name: user.full_name || '',
      position: user.position || '',
      suit_color: form.suit_color,
      suit_size: form.suit_size,
      boot_size: form.boot_size,
      confirmed_at: confirmedAt,
      updated_at: confirmedAt,
    }, { onConflict: 'window_id,crew_id' })

    setSaving(false)
    const nextUser = { ...user, ...profilePayload }
    localStorage.setItem('kmt_user', JSON.stringify(nextUser))
    onSaved(nextUser)
  }

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-2xl">
      <div className="w-full max-w-3xl overflow-hidden rounded-[42px] border border-orange-500/25 bg-zinc-950 shadow-2xl">
        <div className="flex items-start justify-between border-b border-white/10 p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-400">PPE Size Survey</p>
            <h2 className="mt-2 text-3xl font-black italic uppercase text-white">Boiler Suit & Safety Boots</h2>
            <p className="mt-1 text-xs normal-case text-zinc-500">Confirm your current sizes for the next PPE order round.</p>
          </div>
          <button onClick={onClose} className="rounded-2xl bg-white/5 p-3 text-zinc-400 hover:bg-white/10 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[75vh] space-y-5 overflow-y-auto p-6">
          {loading ? (
            <div className="rounded-[28px] border border-white/10 bg-black/40 p-8 text-center text-xs font-black uppercase tracking-widest text-orange-400">Loading size options...</div>
          ) : !activeWindow ? (
            <div className="rounded-[28px] border border-white/10 bg-black/40 p-8 text-center text-xs font-black uppercase tracking-widest text-zinc-500">No active PPE size survey right now</div>
          ) : (
            <>
              <div className="rounded-[28px] border border-amber-500/20 bg-amber-500/10 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-black uppercase text-white">{activeWindow.title || 'PPE Size Update'}</p>
                    {activeWindow.deadline_at && (
                      <p className="mt-1 text-[10px] font-bold normal-case text-amber-200">Deadline: {new Date(activeWindow.deadline_at).toLocaleString()}</p>
                    )}
                  </div>
                  <span className={`rounded-full px-4 py-2 text-[9px] font-black uppercase ${sizeWindowConfirmed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-orange-600 text-white'}`}>
                    {sizeWindowConfirmed ? 'Confirmed, update if needed' : 'Action required'}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[24px] border border-white/10 bg-black/40 p-4">
                  <label className="mb-2 block text-[9px] font-black uppercase tracking-[0.25em] text-zinc-500">Boiler suit color</label>
                  <select value={form.suit_color} onChange={(event) => setForm((prev) => ({ ...prev, suit_color: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-xs font-black text-white outline-none focus:border-orange-500">
                    <option value="">Select color</option>
                    {suitColorOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-black/40 p-4">
                  <label className="mb-2 block text-[9px] font-black uppercase tracking-[0.25em] text-zinc-500">Boiler suit size</label>
                  <select value={form.suit_size} onChange={(event) => setForm((prev) => ({ ...prev, suit_size: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-xs font-black text-white outline-none focus:border-orange-500">
                    <option value="">Select suit size</option>
                    {suitSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-black/40 p-4">
                  <label className="mb-2 block text-[9px] font-black uppercase tracking-[0.25em] text-zinc-500">Safety boots size</label>
                  <select value={form.boot_size} onChange={(event) => setForm((prev) => ({ ...prev, boot_size: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-xs font-black text-white outline-none focus:border-orange-500">
                    <option value="">Select boots size</option>
                    {bootSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-black/35 p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-orange-500/10 p-3 text-orange-300"><Ruler size={20} /></div>
                  <div>
                    <p className="text-xs font-black uppercase text-white">Size chart reference</p>
                    <p className="mt-1 text-[10px] normal-case text-zinc-500">Check the company chart, then confirm your current sizes.</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-white/5 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-200">Boiler suit</p>
                    {sizeCharts.suit ? (
                      <div className="mt-3 flex h-44 items-center justify-center overflow-hidden rounded-xl bg-black/50">
                        <img src={sizeCharts.suit} alt="Boiler suit size chart" className="max-h-full max-w-full object-contain" />
                      </div>
                    ) : (
                      <p className="mt-2 text-[11px] normal-case text-zinc-400">Select color and size from available inventory options.</p>
                    )}
                  </div>
                  <div className="rounded-2xl bg-white/5 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-200">Safety boots</p>
                    {sizeCharts.boot ? (
                      <div className="mt-3 flex h-44 items-center justify-center overflow-hidden rounded-xl bg-black/50">
                        <img src={sizeCharts.boot} alt="Safety boots size chart" className="max-h-full max-w-full object-contain" />
                      </div>
                    ) : (
                      <p className="mt-2 text-[11px] normal-case text-zinc-400">Select the boot size format shown in inventory, e.g. Size 8 / 42.</p>
                    )}
                  </div>
                </div>
              </div>

              <button onClick={save} disabled={saving} className="w-full rounded-[24px] bg-orange-600 px-6 py-5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-orange-600/20 disabled:opacity-50">
                <Save size={16} className="mr-2 inline" /> {saving ? 'Saving...' : 'Confirm Size'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
