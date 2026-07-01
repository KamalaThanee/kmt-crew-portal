'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { readCurrentUser } from '@/lib/currentUser'
import { canViewShipCertificates } from '@/lib/roles'
import { ChevronRight, ShieldCheck, Clock, ShipWheel, Ruler, Save } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

const uniqueSorted = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
const textValue = (value: unknown) => (typeof value === 'string' ? value : value == null ? '' : String(value))

export default function CrewDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>({ progress: 0, ok: 0, warn: 0, exp: 0, miss: 0, total: 0, suit: 0, boot: 0, lastStatus: 'None' })
  const [shipStats, setShipStats] = useState({ expired: 0, due90: 0, surveyDue: 0 })
  const [vesselStats, setVesselStats] = useState({ totalIssues: 0, lowStock: 0, lastIntakeLabel: 'No intake yet' })
  const [activePpeSizeWindow, setActivePpeSizeWindow] = useState<any>(null)
  const [ppeInventory, setPpeInventory] = useState<any[]>([])
  const [ppeSizeForm, setPpeSizeForm] = useState({ suit_color: '', suit_size: '', boot_size: '' })
  const [isSavingPpeSizes, setIsSavingPpeSizes] = useState(false)

  useEffect(() => {
    const u = readCurrentUser()
    if (!u) { router.push('/login'); return; }
    setUser(u);
    setPpeSizeForm({
      suit_color: textValue(u.suit_color),
      suit_size: textValue(u.suit_size),
      boot_size: textValue(u.boot_size),
    });
    fetchStats(u);
  }, [router])

  useEffect(() => {
    if (!activePpeSizeWindow) return
    if (window.location.hash !== '#ppe-size-update' && !window.location.search.includes('ppe=size')) return

    window.setTimeout(() => {
      document.getElementById('ppe-size-update')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 150)
  }, [activePpeSizeWindow])

  async function fetchStats(u: any) {
    try {
      const params = new URLSearchParams({
        userId: String(u.id || ''),
        fullName: String(u.full_name || ''),
        position: String(u.position || ''),
        suitColor: String(u.suit_color || ''),
        suitSize: String(u.suit_size || ''),
        bootSize: String(u.boot_size || ''),
      })
      const response = await fetch(`/api/dashboard-summary?${params.toString()}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error || 'Unable to load dashboard summary')

      setStats(payload.stats || { progress: 0, ok: 0, warn: 0, exp: 0, miss: 0, total: 0, suit: 0, boot: 0, lastStatus: 'No issue yet' })
      setShipStats(payload.shipStats || { expired: 0, due90: 0, surveyDue: 0 })
      setVesselStats(payload.vesselStats || { totalIssues: 0, lowStock: 0, lastIntakeLabel: 'No intake yet' })
      setActivePpeSizeWindow(payload.activePpeSizeWindow || null)
      setPpeInventory(Array.isArray(payload.ppeInventory) ? payload.ppeInventory : [])
    } catch (error: any) {
      console.error('Dashboard summary failed', error)
      toast.error(error?.message || 'Unable to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  const suitInventory = ppeInventory.filter((item) => String(item.item_name || '').toLowerCase().includes('suit'))
  const bootInventory = ppeInventory.filter((item) => {
    const name = String(item.item_name || '').toLowerCase()
    return name.includes('safety boot') && !name.includes('rubber')
  })
  const suitColorOptions = uniqueSorted(suitInventory.map((item) => String(item.color || '').trim()))
  const suitSizeOptions = uniqueSorted(suitInventory.map((item) => String(item.size || '').trim()))
  const bootSizeOptions = uniqueSorted(bootInventory.map((item) => String(item.size || '').trim()))
  const sizeWindowConfirmed = activePpeSizeWindow?.id && String(user?.ppe_size_confirmed_window_id || '') === String(activePpeSizeWindow.id)

  async function handleConfirmPpeSizes() {
    if (!user?.id || !activePpeSizeWindow?.id) return
    if (!ppeSizeForm.suit_color || !ppeSizeForm.suit_size || !ppeSizeForm.boot_size) {
      toast.error('Please select boiler suit color, suit size, and safety boots size')
      return
    }

    setIsSavingPpeSizes(true)
    const confirmedAt = new Date().toISOString()
    const payload = {
      suit_color: ppeSizeForm.suit_color,
      suit_size: ppeSizeForm.suit_size,
      boot_size: ppeSizeForm.boot_size,
      ppe_size_confirmed_at: confirmedAt,
      ppe_size_confirmed_window_id: activePpeSizeWindow.id,
    }
    const { error } = await supabase.from('crews').update(payload).eq('id', user.id)
    setIsSavingPpeSizes(false)
    if (error) {
      toast.error(`${error.message}. Run sql/ppe_size_update_window.sql first.`)
      return
    }

    await supabase.from('ppe_size_responses').upsert({
      window_id: activePpeSizeWindow.id,
      crew_id: user.id,
      crew_name: user.full_name || '',
      position: user.position || '',
      suit_color: ppeSizeForm.suit_color,
      suit_size: ppeSizeForm.suit_size,
      boot_size: ppeSizeForm.boot_size,
      confirmed_at: confirmedAt,
      updated_at: confirmedAt,
    }, { onConflict: 'window_id,crew_id' })

    const nextUser = { ...user, ...payload }
    setUser(nextUser)
    localStorage.setItem('kmt_user', JSON.stringify(nextUser))
    window.dispatchEvent(new Event('kmt-user-changed'))
    window.dispatchEvent(new Event('new-notification'))
    toast.success('PPE sizes confirmed')
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse">LOADING...</div>

  const registeredSuit = [textValue(user?.suit_color), textValue(user?.suit_size)].filter(Boolean).join(' / ') || 'Not registered'
  const registeredBoots = textValue(user?.boot_size) || 'Not registered'

  return (
    <div className="mx-auto max-w-[1380px] px-4 pb-32 pt-28 font-sans text-[10px] font-bold uppercase text-[#17120f] md:px-8">
      <div className="mb-8">
        <h1 className="text-4xl font-black italic tracking-tight text-[#14100d] md:text-5xl">Command Center</h1>
        <p className="mt-2 tracking-[0.24em] text-[#5f5147]">Vessel oversight</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-6">
          <div>
            <p className="mb-3 flex items-center gap-2 tracking-[0.24em] text-[#2a63e0]">
              <ShieldCheck size={14} />
              My Personal
            </p>
            <Link href="/certificates" className="block rounded-[36px] border border-[#efd7c2] bg-white/95 p-6 shadow-[0_20px_55px_rgba(80,52,16,0.08)] transition hover:-translate-y-0.5 hover:border-[#bfd4ff]">
              <div className="flex items-center gap-5">
                <div className="relative h-24 w-24 shrink-0">
                  <svg className="h-full w-full -rotate-90 transform">
                    <circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-[#ece7e2]" />
                    <circle
                      cx="48"
                      cy="48"
                      r="44"
                      stroke="currentColor"
                      strokeWidth="6"
                      fill="transparent"
                      strokeDasharray="276"
                      strokeDashoffset={276 - (stats.progress / 100) * 276}
                      className="text-[#2862cf] transition-all duration-1000"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xl font-black text-[#14100d]">{stats.progress}%</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-end justify-between gap-3">
                    <h2 className="text-2xl font-black italic text-[#14100d]">My Certificates</h2>
                    <p className="text-3xl font-black text-[#2862cf]">
                      {stats.ok + stats.warn}
                      <span className="ml-1 text-base text-[#5f5147]">/ {stats.total}</span>
                    </p>
                  </div>
                  <p className="mt-2 tracking-[0.18em] text-[#5f5147]">Certificate readiness snapshot</p>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-[22px] border border-[#f0cfcf] bg-[#fff1f1] px-4 py-3 text-center">
                  <p className="text-2xl font-black text-[#db3d3d]">{stats.exp}</p>
                  <p className="mt-1 tracking-[0.18em] text-[#8a5d5d]">Exp</p>
                </div>
                <div className="rounded-[22px] border border-[#f3df9e] bg-[#fff6d6] px-4 py-3 text-center">
                  <p className="text-2xl font-black text-[#b88700]">{stats.warn}</p>
                  <p className="mt-1 tracking-[0.18em] text-[#886d12]">90D</p>
                </div>
              </div>
            </Link>
          </div>

          <Link href="/my-requests" className="block rounded-[32px] border border-[#efd7c2] bg-white/92 p-6 shadow-[0_18px_45px_rgba(80,52,16,0.07)] transition hover:-translate-y-0.5 hover:border-[#cce7d8]">
            <div className="flex items-center justify-between">
              <p className="tracking-[0.22em] text-[#5f5147]">My PPE</p>
              <p className="text-sm font-black text-[#2862cf]">{stats.lastStatus}</p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-[22px] bg-[#f7f0ea] px-4 py-4 text-center">
                <p className="tracking-[0.18em] text-[#8a7669]">Suit</p>
                <p className="mt-2 text-3xl font-black text-[#14100d]">{stats.suit}/2</p>
                <p className="mt-2 truncate text-[11px] font-black normal-case text-[#c24c12]" title={registeredSuit}>{registeredSuit}</p>
              </div>
              <div className="rounded-[22px] bg-[#f7f0ea] px-4 py-4 text-center">
                <p className="tracking-[0.18em] text-[#8a7669]">Boots</p>
                <p className="mt-2 text-3xl font-black text-[#14100d]">{stats.boot}/1</p>
                <p className="mt-2 truncate text-[11px] font-black normal-case text-[#c24c12]" title={registeredBoots}>{registeredBoots}</p>
              </div>
            </div>
          </Link>
        </div>

        <div className="space-y-6">
          <div>
            <p className="mb-3 flex items-center gap-2 tracking-[0.24em] text-[#9b49ff]">
              <ShieldCheck size={14} />
              Vessel Oversight
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <Link href="/ppe?view=history" className="rounded-[32px] border border-[#efd7c2] bg-white/92 p-6 shadow-[0_18px_55px_rgba(80,52,16,0.08)] transition hover:-translate-y-0.5 hover:border-[#f2c76f]">
                <div className="mb-8 flex items-start justify-between">
                  <div className="rounded-[22px] bg-[#fff2d9] p-4 text-[#bc7b00]">
                    <Clock size={26} />
                  </div>
                  <ChevronRight className="text-[#8a7669]" size={18} />
                </div>
                <p className="text-5xl font-black text-[#14100d]">{vesselStats.totalIssues}</p>
                <p className="mt-2 tracking-[0.18em] text-[#bc7b00]">Total Issues</p>
              </Link>

              <Link href="/inventory?lowStock=1" className="rounded-[32px] border border-[#d9e6ff] bg-white/92 p-6 shadow-[0_18px_55px_rgba(80,52,16,0.08)] transition hover:-translate-y-0.5 hover:border-[#8db3ff]">
                <div className="mb-8 flex items-start justify-between">
                  <div className="rounded-[22px] bg-[#eaf2ff] p-4 text-[#2e63d1]">
                    <ShipWheel size={26} />
                  </div>
                  <ChevronRight className="text-[#8a7669]" size={18} />
                </div>
                <p className="text-5xl font-black text-[#14100d]">{vesselStats.lowStock}</p>
                <p className="mt-2 tracking-[0.18em] text-[#2e63d1]">Low Stock Alert</p>
              </Link>

              <Link href="/inventory?restock=history" className="rounded-[32px] border border-[#cfead8] bg-white/92 p-6 shadow-[0_18px_55px_rgba(80,52,16,0.08)] transition hover:-translate-y-0.5 hover:border-[#75c798]">
                <div className="mb-8 flex items-start justify-between">
                  <div className="rounded-[22px] bg-[#e8f8ee] p-4 text-[#168e58]">
                    <ShipWheel size={26} />
                  </div>
                  <ChevronRight className="text-[#8a7669]" size={18} />
                </div>
                <p className="text-4xl font-black text-[#14100d]">{vesselStats.lastIntakeLabel}</p>
                <p className="mt-2 tracking-[0.18em] text-[#168e58]">Last Intake History</p>
              </Link>
            </div>
          </div>

          {activePpeSizeWindow && (
            <div id="ppe-size-update" className="scroll-mt-28 rounded-[36px] border border-[#f0d59a] bg-[#fff7e6] p-6 shadow-[0_18px_50px_rgba(80,52,16,0.08)]">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-4">
                  <div className="rounded-[22px] bg-[#fff0c8] p-4 text-[#bc7b00]"><Ruler size={24} /></div>
                  <div>
                    <h3 className="text-xl font-black italic text-[#14100d]">PPE Size Update</h3>
                    <p className="mt-1 normal-case text-[#6b584c]">{activePpeSizeWindow.title || 'Confirm boiler suit and safety boots sizes'}</p>
                    {activePpeSizeWindow.deadline_at && (
                      <p className="mt-1 text-[9px] tracking-[0.18em] text-[#b88700]">Deadline: {new Date(activePpeSizeWindow.deadline_at).toLocaleString()}</p>
                    )}
                  </div>
                </div>
                <span className={`rounded-full px-4 py-2 text-[9px] font-black ${sizeWindowConfirmed ? 'bg-[#dff6e9] text-[#168e58]' : 'bg-orange-600 text-white'}`}>
                  {sizeWindowConfirmed ? 'Confirmed' : 'Action Required'}
                </span>
              </div>
              <div className="mt-5 grid gap-3 xl:grid-cols-4">
                <select value={ppeSizeForm.suit_color} onChange={(event) => setPpeSizeForm((prev) => ({ ...prev, suit_color: event.target.value }))} className="rounded-2xl border border-[#ecd7b0] bg-white px-4 py-3 text-xs font-black text-[#14100d] outline-none focus:border-[#d89d2b]">
                  <option value="">Boiler suit color</option>
                  {suitColorOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                <select value={ppeSizeForm.suit_size} onChange={(event) => setPpeSizeForm((prev) => ({ ...prev, suit_size: event.target.value }))} className="rounded-2xl border border-[#ecd7b0] bg-white px-4 py-3 text-xs font-black text-[#14100d] outline-none focus:border-[#d89d2b]">
                  <option value="">Boiler suit size</option>
                  {suitSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                <select value={ppeSizeForm.boot_size} onChange={(event) => setPpeSizeForm((prev) => ({ ...prev, boot_size: event.target.value }))} className="rounded-2xl border border-[#ecd7b0] bg-white px-4 py-3 text-xs font-black text-[#14100d] outline-none focus:border-[#d89d2b]">
                  <option value="">Safety boots size</option>
                  {bootSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                <button onClick={handleConfirmPpeSizes} disabled={isSavingPpeSizes} className="rounded-2xl bg-orange-600 px-4 py-3 text-xs font-black text-white shadow-lg shadow-orange-600/20 disabled:opacity-50">
                  <Save size={14} className="mr-2 inline" /> {isSavingPpeSizes ? 'Saving...' : 'Confirm Size'}
                </button>
              </div>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Link href="/certificates?tab=crew" className="group rounded-[38px] border border-[#e3d5ff] bg-[#f7f1ff] p-7 shadow-[0_18px_55px_rgba(80,52,16,0.08)] transition hover:-translate-y-0.5 hover:border-[#bf9cff]">
              <div className="flex items-center gap-6">
                <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-[30px] border border-[#dcc9ff] bg-[#efe6ff] text-[#9b49ff]">
                  <p className="text-5xl font-black">{stats.progress}%</p>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-black italic text-[#14100d]">Crew Certificates</h3>
                      <p className="mt-2 tracking-[0.18em] text-[#6b5b82]">Fleet readiness by crew matrix</p>
                    </div>
                    <ChevronRight className="text-[#8a7669] transition-transform group-hover:translate-x-1" size={20} />
                  </div>
                </div>
              </div>
            </Link>

            {canViewShipCertificates(user?.position) && (
              <Link href="/certificates?tab=ship" className="group rounded-[38px] border border-[#caeef5] bg-[#f0fbfd] p-7 shadow-[0_18px_55px_rgba(80,52,16,0.08)] transition hover:-translate-y-0.5 hover:border-[#74d5ea]">
                <div className="flex items-center gap-6">
                  <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-[30px] border border-[#bcebf5] bg-[#dff8fd] text-[#17b4db]">
                    <p className="text-5xl font-black">{shipStats.expired + shipStats.due90 + shipStats.surveyDue}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h3 className="text-2xl font-black italic text-[#14100d]">Ship Certificate Watch</h3>
                        <p className="mt-2 tracking-[0.18em] text-[#5f5147]">Expired, due 90 days, and survey due</p>
                      </div>
                      <ChevronRight className="text-[#8a7669] transition-transform group-hover:translate-x-1" size={20} />
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <div className="rounded-[20px] border border-[#f2cfd2] bg-[#fff2f2] px-4 py-3 text-center">
                        <p className="text-2xl font-black text-[#db3d3d]">{shipStats.expired}</p>
                        <p className="mt-1 tracking-[0.16em] text-[#8a5d5d]">Exp</p>
                      </div>
                      <div className="rounded-[20px] border border-[#f3df9e] bg-[#fff8de] px-4 py-3 text-center">
                        <p className="text-2xl font-black text-[#c28c00]">{shipStats.due90}</p>
                        <p className="mt-1 tracking-[0.16em] text-[#886d12]">90D</p>
                      </div>
                      <div className="rounded-[20px] border border-[#bee9f3] bg-[#e8fbff] px-4 py-3 text-center">
                        <p className="text-2xl font-black text-[#17b4db]">{shipStats.surveyDue}</p>
                        <p className="mt-1 tracking-[0.16em] text-[#3f7480]">Survey</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
