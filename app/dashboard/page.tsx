'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { calculateCrewCertificateCompliance } from '@/lib/certCompliance'
import { applyPpeRequestUserFilter } from '@/lib/ppeRequests'
import { getShipCertificateStatus, getShipSurveyStatus } from '@/lib/shipCertificates'
import { canViewShipCertificates } from '@/lib/roles'
import { ChevronRight, ShieldCheck, Clock, ShipWheel, Ruler, Save } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

const uniqueSorted = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

export default function CrewDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>({ progress: 0, ok: 0, warn: 0, exp: 0, miss: 0, total: 0, suit: 0, boot: 0, lastStatus: 'None' })
  const [shipStats, setShipStats] = useState({ expired: 0, due90: 0, surveyDue: 0 })
  const [activePpeSizeWindow, setActivePpeSizeWindow] = useState<any>(null)
  const [ppeInventory, setPpeInventory] = useState<any[]>([])
  const [ppeSizeForm, setPpeSizeForm] = useState({ suit_color: '', suit_size: '', boot_size: '' })
  const [isSavingPpeSizes, setIsSavingPpeSizes] = useState(false)

  useEffect(() => {
    const uStr = localStorage.getItem('kmt_user')
    if (!uStr) { router.push('/login'); return; }
    const u = JSON.parse(uStr);
    setUser(u);
    setPpeSizeForm({
      suit_color: u.suit_color || '',
      suit_size: u.suit_size || '',
      boot_size: u.boot_size || '',
    });
    fetchStats(u);
  }, [router])

  async function fetchStats(u: any) {
    const [
      matrixRes,
      myCertsRes,
      rulesRes,
    ] = await Promise.all([
      supabase.from('cert_matrix').select('*'),
      supabase.from('crew_certs').select('*').eq('crew_id', u.id),
      supabase.from('cert_rules').select('*'),
    ])
    const reqQuery = await applyPpeRequestUserFilter(
      supabase.from('ppe_requests')
        .select('*')
        .neq('status', 'rejected')
        .order('created_at', { ascending: false }),
      u,
    )
    const { data: myReqs } = await reqQuery
    const { data: shipCerts } = canViewShipCertificates(u.position)
      ? await supabase.from('ship_certificates').select('*')
      : { data: [] as any[] }
    const [sizeWindowRes, inventoryRes] = await Promise.all([
      supabase
        .from('ppe_size_windows')
        .select('*')
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('ppe_inventory').select('item_name, color, size'),
    ])
    if (!sizeWindowRes.error) setActivePpeSizeWindow(sizeWindowRes.data || null)
    if (!inventoryRes.error) setPpeInventory(inventoryRes.data || [])
    
    const matrix = matrixRes.data || []
    const myCerts = myCertsRes.data || []
    const rules = rulesRes.data || []

    if (matrix.length) {
      const certData = calculateCrewCertificateCompliance({ crew: u, crewCerts: myCerts, matrix, rules })

      let sCount = 0, bCount = 0;
      myReqs?.forEach((r: any) => {
        r.items?.forEach((i: any) => {
          if (i.item_name.toLowerCase().includes('suit')) sCount++
          if (i.item_name.toLowerCase().includes('safety boot') && !i.item_name.toLowerCase().includes('rubber')) bCount++
        })
      })

      setStats({
        total: certData.mandatoryTotal,
        ok: certData.ok,
        warn: certData.warning,
        exp: certData.expired,
        miss: certData.missing,
        progress: certData.progress,
        suit: sCount, boot: bCount, lastStatus: myReqs?.[0]?.status || 'No Request'
      })
    }
    const shipRows = shipCerts || []
    setShipStats({
      expired: shipRows.filter((cert: any) => getShipCertificateStatus(cert) === 'expired').length,
      due90: shipRows.filter((cert: any) => ['due-30', 'due-60', 'due-90'].includes(getShipCertificateStatus(cert))).length,
      surveyDue: shipRows.filter((cert: any) => ['survey-overdue', 'survey-due-30', 'survey-due-60', 'survey-due-90'].includes(getShipSurveyStatus(cert))).length,
    })
    setLoading(false)
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

    const nextUser = { ...user, ...payload }
    setUser(nextUser)
    localStorage.setItem('kmt_user', JSON.stringify(nextUser))
    window.dispatchEvent(new Event('kmt-user-changed'))
    window.dispatchEvent(new Event('new-notification'))
    toast.success('PPE sizes confirmed')
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse">LOADING...</div>

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-32 pt-28 font-sans text-white uppercase font-bold text-[10px]">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6"><div><h1 className="text-3xl md:text-4xl font-black italic">My Dashboard</h1><p className="text-zinc-500 mt-1 tracking-widest">Personal readiness and PPE status</p></div></div>
      
      <div className="space-y-6">
        <Link href="/certificates" className="block bg-slate-900 border border-blue-500/20 p-8 rounded-[40px] shadow-2xl hover:border-blue-500 transition-all group">
          <div className="flex flex-col md:flex-row items-center gap-8 mb-8">
            <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90"><circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-white/5"/><circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray="276" strokeDashoffset={276 - (stats.progress/100)*276} className="text-blue-500 transition-all duration-1000"/></svg>
              <span className="absolute text-xl font-black">{stats.progress}%</span>
            </div>
            <div className="text-center md:text-left flex-1">
              <h3 className="text-xl font-black italic">My Certificates</h3>
              <p className="text-blue-400 mt-1 mb-4">{stats.ok + stats.warn} / {stats.total} Valid Documents</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                 <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-xl text-center"><p className="text-emerald-500 text-sm">{stats.ok}</p><p className="text-[7px]">READY</p></div>
                 <div className="bg-amber-500/10 border border-amber-500/20 p-2 rounded-xl text-center"><p className="text-amber-500 text-sm">{stats.warn}</p><p className="text-[7px]">90 DAYS</p></div>
                 <div className="bg-red-500/10 border border-red-500/20 p-2 rounded-xl text-center"><p className="text-red-500 text-sm">{stats.exp}</p><p className="text-[7px]">EXPIRED</p></div>
                 <div className="bg-white/5 p-2 rounded-xl text-center text-slate-500"><p className="text-sm">{stats.miss}</p><p className="text-[7px]">MISSING</p></div>
              </div>
            </div>
          </div>
          <p className="text-right text-blue-400">Manage Certificates <ChevronRight size={14} className="inline"/></p>
        </Link>

        <div className="grid grid-cols-2 gap-6">
          {activePpeSizeWindow && (
            <div className="col-span-2 bg-amber-500/10 border border-amber-500/30 p-6 rounded-[36px] shadow-xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="bg-amber-500/15 border border-amber-500/20 p-4 rounded-[24px] text-amber-300"><Ruler size={24}/></div>
                  <div>
                    <h3 className="text-lg font-black italic">PPE Size Update</h3>
                    <p className="mt-1 text-amber-100/70 normal-case">
                      {activePpeSizeWindow.title || 'Confirm boiler suit and safety boots sizes'}
                    </p>
                    {activePpeSizeWindow.deadline_at && (
                      <p className="mt-1 text-[9px] text-amber-300">Deadline: {new Date(activePpeSizeWindow.deadline_at).toLocaleString()}</p>
                    )}
                  </div>
                </div>
                <span className={`rounded-full px-4 py-2 text-[9px] font-black ${sizeWindowConfirmed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-orange-600 text-white'}`}>
                  {sizeWindowConfirmed ? 'CONFIRMED' : 'ACTION REQUIRED'}
                </span>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <select value={ppeSizeForm.suit_color} onChange={(event) => setPpeSizeForm((prev) => ({ ...prev, suit_color: event.target.value }))} className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-xs font-black text-white outline-none focus:border-amber-500">
                  <option value="">Boiler suit color</option>
                  {suitColorOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                <select value={ppeSizeForm.suit_size} onChange={(event) => setPpeSizeForm((prev) => ({ ...prev, suit_size: event.target.value }))} className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-xs font-black text-white outline-none focus:border-amber-500">
                  <option value="">Boiler suit size</option>
                  {suitSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                <select value={ppeSizeForm.boot_size} onChange={(event) => setPpeSizeForm((prev) => ({ ...prev, boot_size: event.target.value }))} className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-xs font-black text-white outline-none focus:border-amber-500">
                  <option value="">Safety boots size</option>
                  {bootSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                <button onClick={handleConfirmPpeSizes} disabled={isSavingPpeSizes} className="rounded-2xl bg-orange-600 px-4 py-3 text-xs font-black text-white shadow-lg shadow-orange-600/20 disabled:opacity-50">
                  <Save size={14} className="mr-2 inline"/> {isSavingPpeSizes ? 'SAVING...' : 'CONFIRM SIZE'}
                </button>
              </div>
            </div>
          )}

          <Link href="/my-requests" className="bg-slate-900 border border-white/5 p-8 rounded-[40px] flex flex-col justify-between shadow-xl h-44 hover:border-emerald-500 transition-all">
             <div className="flex justify-between items-center"><p className="text-slate-500">PPE Usage</p><ShieldCheck className="text-emerald-500" size={20}/></div>
             <div className="grid grid-cols-2 gap-2 my-2">
                <div className="text-center"><p className="text-[7px] text-slate-600">SUIT</p><p className="text-sm font-black">{stats.suit}/2</p></div>
                <div className="text-center"><p className="text-[7px] text-slate-600">BOOTS</p><p className="text-sm font-black">{stats.boot}/1</p></div>
             </div>
             <p className="text-emerald-400">History & Status <ChevronRight size={12} className="inline"/></p>
          </Link>
          <div className="bg-slate-900 border border-white/5 p-8 rounded-[40px] flex flex-col justify-between shadow-xl h-44">
            <Clock className="text-blue-500" size={32}/>
            <div><p className="text-xs uppercase text-slate-500">Last Req. Status</p><p className="text-lg font-black text-blue-400">{stats.lastStatus}</p></div>
          </div>
        </div>

        {canViewShipCertificates(user?.position) && (
          <Link href="/certificates?tab=ship" className="block bg-slate-900 border border-cyan-500/20 p-8 rounded-[40px] shadow-2xl hover:border-cyan-400 transition-all group">
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="bg-cyan-500/10 border border-cyan-500/20 p-4 rounded-[28px] text-cyan-300"><ShipWheel size={28}/></div>
                <div>
                  <h3 className="text-xl font-black italic">Ship Certificates</h3>
                  <p className="text-cyan-300 mt-1">Vessel compliance watch</p>
                </div>
              </div>
              <ChevronRight className="text-cyan-400 group-hover:translate-x-1 transition-transform" size={20}/>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-6">
              <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl text-center"><p className="text-red-400 text-sm">{shipStats.expired}</p><p className="text-[7px]">EXP</p></div>
              <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl text-center"><p className="text-amber-300 text-sm">{shipStats.due90}</p><p className="text-[7px]">90D</p></div>
              <div className="bg-cyan-500/10 border border-cyan-500/20 p-3 rounded-xl text-center"><p className="text-cyan-300 text-sm">{shipStats.surveyDue}</p><p className="text-[7px]">SURVEY</p></div>
            </div>
          </Link>
        )}
      </div>
    </div>
  )
}
