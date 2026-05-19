'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { calculateCrewCertificateCompliance } from '@/lib/certCompliance'
import { applyPpeRequestUserFilter } from '@/lib/ppeRequests'
import { getShipCertificateStatus, getShipSurveyStatus } from '@/lib/shipCertificates'
import { 
  User, AlertTriangle, ChevronRight, ShieldCheck, RefreshCw, Clock, Archive
} from 'lucide-react'
import Link from 'next/link'

const isCrewActive = (crew: any) => crew?.is_active !== false && !crew?.resigned_at;

export default function AdminDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [personal, setPersonal] = useState<any>({ progress: 0, okCount: 0, reqCount: 0, expired: 0, warning: 0, missing: 0, suit: 0, boot: 0, lastStatus: 'None' })
  const [vessel, setVessel] = useState<any>({ issueTotal: 0, openQueue: 0, lowStock: 0, vesselExpired: 0, compliance: 0, totalItems: 0, vesselWarning: 0, lastRestockDate: 'No data', shipExpired: 0, shipDue90: 0, shipSurveyDue: 0 })

  useEffect(() => {
    const uStr = localStorage.getItem('kmt_user')
    if (uStr) { const u = JSON.parse(uStr); setUser(u); fetchAdminData(u); }
  }, [])

  async function fetchAdminData(u: any) {
    setLoading(true)
    const myReqsQuery = await applyPpeRequestUserFilter(
      supabase.from('ppe_requests')
        .select('*')
        .neq('status', 'rejected')
        .order('created_at', { ascending: false }),
      u,
    )

    const [matrixRes, crewsRes, allCertsRes, invRes, restockRes, myReqsRes, shipCertsRes, rulesRes, issueRowsRes] = await Promise.all([
      supabase.from('cert_matrix').select('*'),
      supabase.from('crews').select('*'),
      supabase.from('crew_certs').select('*'),
      supabase.from('ppe_inventory').select('quantity, threshold'),
      supabase.from('restock_history').select('created_at').order('created_at', { ascending: false }).limit(1),
      myReqsQuery,
      supabase.from('ship_certificates').select('*'),
      supabase.from('cert_rules').select('*'),
      supabase.from('ppe_requests').select('status'),
    ]);

    const matrix = matrixRes.data || []; const allCerts = allCertsRes.data || [];
    const activeCrews = (crewsRes.data || []).filter(isCrewActive);
    const inventory = invRes.data || []; const lastRestock = restockRes.data || [];
    const shipCerts = shipCertsRes.data || [];
    const rules = rulesRes.data || [];

    let suit = 0; let boot = 0;
    const myCerts = allCerts.filter(cc => cc.crew_id === u.id);
    const myCertData = calculateCrewCertificateCompliance({ crew: u, crewCerts: myCerts, matrix, rules });

    const issueRows = issueRowsRes.data || [];
    const openQueue = issueRows.filter((row: any) => ['pending', 'approved'].includes(String(row.status || '').toLowerCase())).length;

    const vesselProgress = activeCrews.map((crew: any) => {
      const crewCerts = allCerts.filter((cert: any) => cert.crew_id === crew.id)
      const certData = calculateCrewCertificateCompliance({ crew, crewCerts, matrix, rules })
      return certData.mandatoryTotal > 0 ? certData.progress : null
    }).filter((value: number | null): value is number => value !== null)

    const vesselCompliance = vesselProgress.length > 0
      ? Math.round(vesselProgress.reduce((sum: number, value: number) => sum + value, 0) / vesselProgress.length)
      : 0

    setPersonal({ progress: myCertData.progress, okCount: myCertData.ok, reqCount: myCertData.mandatoryTotal, expired: myCertData.expired, warning: myCertData.warning, missing: myCertData.missing, suit, boot, lastStatus: myReqsRes.data?.[0]?.status || 'None' });
    
    setVessel({ 
      issueTotal: issueRows.length,
      openQueue,
      lowStock: inventory.filter(i => (i.quantity||0) <= (i.threshold||0)).length, 
      totalItems: inventory.reduce((a, b) => a + (b.quantity || 0), 0), 
      compliance: vesselCompliance,
      lastRestockDate: lastRestock.length > 0 ? new Date(lastRestock[0].created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'N/A',
      shipExpired: shipCerts.filter((cert: any) => getShipCertificateStatus(cert) === 'expired').length,
      shipDue90: shipCerts.filter((cert: any) => ['due-30', 'due-60', 'due-90'].includes(getShipCertificateStatus(cert))).length,
      shipSurveyDue: shipCerts.filter((cert: any) => ['survey-overdue', 'survey-due-30', 'survey-due-60', 'survey-due-90'].includes(getShipSurveyStatus(cert))).length,
    });
    setLoading(false);
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-black text-orange-500 font-black animate-pulse uppercase tracking-widest text-xs">Command Hub...</div>

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-32 pt-28 font-sans text-white uppercase font-bold text-[10px]">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div><h1 className="text-3xl md:text-4xl font-black italic flex items-center gap-3 text-white"><ShieldCheck className="text-orange-500" size={36}/> Command Center</h1><p className="text-zinc-500 mt-1 tracking-widest">Vessel Oversight</p></div>
        <button onClick={() => fetchAdminData(user)} className="p-3 bg-zinc-900 border border-white/5 rounded-full hover:bg-orange-600 transition-all"><RefreshCw size={20}/></button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-6">
           <h2 className="text-blue-500 tracking-widest flex items-center gap-2 mb-2"><User size={16}/> My Personal</h2>
           <Link href="/certificates" className="block bg-zinc-900 border border-blue-500/20 p-6 rounded-[32px] shadow-2xl hover:border-blue-500 transition-all">
              <div className="flex justify-between items-center mb-4">
                 <div className="relative w-16 h-16 flex items-center justify-center"><svg className="w-full h-full transform -rotate-90"><circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white/5"/><circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray="176" strokeDashoffset={176 - (personal.progress/100)*176} className="text-blue-500"/></svg><span className="absolute text-[10px] font-black">{personal.progress}%</span></div>
                 <div className="text-right"><p className="text-blue-400 text-lg">{personal.okCount}/{personal.reqCount}</p><p className="text-[7px]">Certs</p></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                 <div className="bg-red-500/10 p-2 rounded-xl text-center border border-red-500/10"><p className="text-red-500 text-xs">{personal.expired}</p><p className="text-[6px]">EXP</p></div>
                 <div className="bg-amber-500/10 p-2 rounded-xl text-center border border-amber-500/10"><p className="text-amber-500 text-xs">{personal.warning}</p><p className="text-[6px]">90D</p></div>
              </div>
           </Link>
           <Link href="/my-requests" className="block bg-zinc-900 border border-white/5 p-6 rounded-[32px] space-y-4 hover:border-emerald-500 transition-all">
              <div className="flex justify-between items-center"><p className="text-zinc-500 uppercase">My PPE</p><span className="text-blue-400 font-black">{personal.lastStatus}</span></div>
              <div className="flex gap-4">
                 <div className="flex-1 text-center"><p className="text-[7px] text-zinc-600 uppercase">Suit</p><p className="text-sm font-black">{personal.suit}/2</p></div>
                 <div className="flex-1 text-center"><p className="text-[7px] text-zinc-600 uppercase">Boots</p><p className="text-sm font-black">{personal.boot}/1</p></div>
              </div>
           </Link>
        </div>

        <div className="lg:col-span-3 space-y-6">
           <h2 className="text-purple-500 tracking-widest flex items-center gap-2 mb-2"><ShieldCheck size={16}/> Vessel Oversight</h2>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link href="/ppe?view=history" className="bg-zinc-900/40 border border-amber-500/20 p-5 rounded-[32px] flex flex-col justify-between h-40 shadow-lg hover:border-amber-500 transition-all group">
                 <div className="flex justify-between items-start"><div className="bg-amber-500/20 p-2.5 rounded-xl text-amber-500 w-fit"><Clock size={20}/></div><ChevronRight size={16} className="text-zinc-700 group-hover:text-amber-500"/></div>
                 <div><p className="text-2xl font-black">{vessel.issueTotal}</p><p className="text-amber-500 uppercase text-[8px]">Total Issues</p></div>
              </Link>
              <Link href="/ppe?view=history" className="bg-zinc-900/40 border border-red-500/20 p-5 rounded-[32px] flex flex-col justify-between h-40 shadow-lg hover:border-red-500 transition-all group">
                 <div className="flex justify-between items-start"><div className="bg-red-500/20 p-2.5 rounded-xl text-red-500 w-fit"><Clock size={20}/></div><ChevronRight size={16} className="text-zinc-700 group-hover:text-red-500"/></div>
                 <div><p className="text-2xl font-black">{vessel.openQueue}</p><p className="text-red-500 uppercase text-[8px]">Open Queue</p></div>
              </Link>
              <Link href="/admin/inventory?filter=low" className="bg-zinc-900/40 border border-blue-500/20 p-5 rounded-[32px] flex flex-col justify-between h-40 shadow-lg hover:border-blue-500 transition-all group">
                 <div className="flex justify-between items-start"><div className="bg-blue-500/20 p-2.5 rounded-xl text-blue-500 w-fit"><AlertTriangle size={20}/></div><ChevronRight size={16} className="text-zinc-700 group-hover:text-blue-500"/></div>
                 <div><p className="text-2xl font-black">{vessel.lowStock}</p><p className="text-blue-500 uppercase text-[8px]">Low Stock Alert</p></div>
              </Link>
              {/* 🎯 แก้ไขลิงก์: ให้ไปที่แท็บ History ในหน้า Inventory */}
              <Link href="/admin/inventory?action=restock&tab=history" className="bg-zinc-900/40 border border-emerald-500/20 p-5 rounded-[32px] flex flex-col justify-between h-40 shadow-lg hover:border-emerald-500 transition-all group">
                 <div className="flex justify-between items-start"><div className="bg-emerald-500/20 p-2.5 rounded-xl text-emerald-500 w-fit"><Archive size={20}/></div><ChevronRight size={16} className="text-zinc-700 group-hover:text-emerald-500"/></div>
                 <div><p className="text-sm font-black uppercase text-white truncate">{vessel.lastRestockDate}</p><p className="text-emerald-500 uppercase text-[8px]">Last Intake History</p></div>
              </Link>

              <div className="col-span-2 md:col-span-4 rounded-[40px] border border-purple-500/20 bg-zinc-900/40 p-6 shadow-2xl">
                 <div className="grid gap-4 lg:grid-cols-[1fr_1.35fr]">
                    <Link href="/certificates?tab=crew&filter=action" className="group flex items-center gap-5 rounded-[32px] border border-purple-500/10 bg-purple-500/5 p-5 transition-all hover:border-purple-500/50 hover:bg-purple-500/10">
                       <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[32px] border border-purple-500/20 bg-purple-500/10 text-2xl font-black text-purple-500 shadow-inner">{vessel.compliance}%</div>
                       <div className="min-w-0">
                          <p className="text-lg font-black italic uppercase text-white">Crew Certificates</p>
                          <p className="mt-1 text-[8px] uppercase text-zinc-500">Fleet readiness by crew matrix</p>
                       </div>
                       <ChevronRight size={18} className="ml-auto text-zinc-700 group-hover:text-purple-400"/>
                    </Link>
                    <Link href="/admin/ship-certificates" className="group flex flex-col gap-4 rounded-[32px] border border-cyan-500/10 bg-cyan-500/5 p-5 transition-all hover:border-cyan-500/50 hover:bg-cyan-500/10 md:flex-row md:items-center md:justify-between">
                       <div className="flex items-center gap-5">
                          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[32px] border border-cyan-500/20 bg-cyan-500/10 text-2xl font-black text-cyan-400 shadow-inner">{vessel.shipExpired + vessel.shipDue90 + vessel.shipSurveyDue}</div>
                          <div>
                             <p className="text-lg font-black italic uppercase text-white">Ship Certificate Watch</p>
                             <p className="mt-1 text-[8px] uppercase text-zinc-500">Expired, due 90 days, and survey due</p>
                          </div>
                       </div>
                       <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3"><p className="text-lg text-red-400">{vessel.shipExpired}</p><p className="text-[7px] text-zinc-500">EXP</p></div>
                          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3"><p className="text-lg text-amber-300">{vessel.shipDue90}</p><p className="text-[7px] text-zinc-500">90D</p></div>
                          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3"><p className="text-lg text-cyan-300">{vessel.shipSurveyDue}</p><p className="text-[7px] text-zinc-500">SURVEY</p></div>
                       </div>
                    </Link>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  )
}
