'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { 
  Settings, Users, Package, SlidersHorizontal, Search, FileCheck, Clock, Eye, CheckCircle2,
  Loader2, Upload, Edit, RefreshCw, X, Save, AlertTriangle, Box, Plus, ChevronDown, ChevronRight, XCircle
} from 'lucide-react'
import imageCompression from 'browser-image-compression'

const normalize = (str: string) => String(str || "").toLowerCase().replace(/[^a-z0-9]/g, "");

function SettingsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('crews')
  const [uploading, setUploading] = useState({ suit: false, boot: false })
  const [sizeCharts, setSizeCharts] = useState({ suit: '', boot: '' })
  
  const [inventory, setInventory] = useState<any[]>([])
  const [crews, setCrews] = useState<any[]>([])
  const [certMatrix, setCertMatrix] = useState<any[]>([])
  const [allCrewCerts, setAllCrewCerts] = useState<any[]>([])
  const [rules, setRules] = useState<any[]>([])
  
  const [searchTerm, setSearchTerm] = useState('')
  const [filterMode, setFilterMode] = useState('all') // 🎯 all, ok, warning, action, 90days, expired

  const [editingCrew, setEditingCrew] = useState<any>(null)
  const [isEditCrewOpen, setIsEditCrewOpen] = useState(false)

  const fetchData = async () => {
    const { data: st } = await supabase.from('ppe_settings').select('*').eq('id', 1).single()
    if (st) setSizeCharts({ suit: st.suit_chart_url || '', boot: st.boot_url || '' })
    const { data: inv } = await supabase.from('ppe_inventory').select('*').order('item_name')
    if (inv) setInventory(inv)
    const { data: cr } = await supabase.from('crews').select('*').order('full_name')
    if (cr) setCrews(cr)
    const { data: mx } = await supabase.from('cert_matrix').select('*')
    if (mx) setCertMatrix(mx)
    const { data: cc } = await supabase.from('crew_certs').select('*')
    if (cc) setAllCrewCerts(cc)
    const { data: ru } = await supabase.from('cert_rules').select('*')
    if (ru) setRules(ru)
  }

  useEffect(() => {
    const checkAuth = async () => {
      const userStr = localStorage.getItem('kmt_user')
      if (!userStr) { router.replace('/login'); return; }
      const user = JSON.parse(userStr)
      const adminRoles = ["safety officer", "chief officer", "barge master"]
      if (!adminRoles.includes((user.position || "").toLowerCase())) { router.replace('/ppe'); return; }
      await fetchData(); setLoading(false);
    }
    checkAuth()
  }, [router])

  const getCrewCertDetails = (crew: any) => {
    if (certMatrix.length === 0) return { progress: 0, expired: 0, warning: 0, list: [] };
    const crewPosNorm = normalize(crew.position);
    let required = certMatrix.filter(row => normalize(row.position) === crewPosNorm && row.requirement_type === 'P').map(m => ({ ...m, is_mandatory: true }));
    const crewCerts = allCrewCerts.filter(c => c.crew_id === crew.id);
    const today = new Date();
    let okCount = 0; let expiredCount = 0; let warningCount = 0;
    
    const detailedList = required.map(req => {
      const uploaded = crewCerts.find(c => normalize(c.cert_name) === normalize(req.cert_name));
      let status = 'missing'
      if (uploaded) {
        if (uploaded.expiry_date === '2099-12-31') { status = 'ok'; okCount++; }
        else {
          const expDate = new Date(uploaded.expiry_date)
          const diff = (expDate.getTime() - today.getTime())/86400000;
          if (diff < 0) { status = 'expired'; expiredCount++; }
          else if (diff <= 90) { status = 'warning'; warningCount++; okCount++; }
          else { status = 'ok'; okCount++; }
        }
      }
      return { ...req, uploaded, status }
    })
    const progress = required.length > 0 ? Math.round((okCount / required.length) * 100) : 0;
    return { progress, expired: expiredCount, warning: warningCount, list: detailedList };
  }

  const enhancedCrews = useMemo(() => {
    return crews.map(crew => ({ ...crew, certData: getCrewCertDetails(crew) }))
    .filter(crew => {
      const matchesSearch = crew.full_name.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;
      if (filterMode === 'all') return true;
      if (filterMode === 'ok') return crew.certData.progress === 100 && crew.certData.expired === 0;
      if (filterMode === 'warning') return crew.certData.warning > 0 && crew.certData.expired === 0;
      if (filterMode === 'action') return crew.certData.progress < 100 || crew.certData.expired > 0;
      if (filterMode === '90days') return crew.certData.warning > 0;
      if (filterMode === 'expired') return crew.certData.expired > 0;
      return true;
    })
  }, [crews, searchTerm, filterMode, certMatrix, allCrewCerts])

  const crewSummary = useMemo(() => {
    const all = crews.map(c => getCrewCertDetails(c));
    return {
      total: crews.length,
      ok: all.filter(c => c.progress === 100 && c.expired === 0).length,
      warning: all.filter(c => c.warning > 0 && c.expired === 0).length,
      action: all.filter(c => c.progress < 100 || c.expired > 0).length,
      days90: all.filter(c => c.warning > 0).length,
      expired: all.filter(c => c.expired > 0).length
    }
  }, [crews, certMatrix, allCrewCerts])

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse uppercase">Loading...</div>

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pb-32 pt-20 px-4 md:px-8 text-[10px] uppercase font-bold">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <h1 className="text-3xl font-black italic flex items-center gap-3"><Settings className="text-blue-500"/> Admin Panel</h1>
          <button onClick={() => router.push('/admin/dashboard')} className="p-3 bg-white/5 rounded-full hover:bg-white/10"><X/></button>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-64 space-y-2 shrink-0">
            {['inventory', 'crews', 'system'].map(t => (
              <button key={t} onClick={() => setActiveTab(t)} className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${activeTab === t ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-400'}`}>
                {t === 'inventory' ? <Package size={18}/> : t === 'crews' ? <Users size={18}/> : <SlidersHorizontal size={18}/>} {t} Master
              </button>
            ))}
          </div>

          <div className="flex-1 bg-slate-900 border border-white/10 rounded-[32px] p-6 md:p-8 shadow-2xl min-h-[60vh]">
            {activeTab === 'crews' && (
              <div className="animate-in fade-in space-y-8">
                <h2 className="text-2xl font-black italic text-white leading-none">Crew Master</h2>
                
                {/* 🎯 สถิติ 6 ช่องแบบในรูปที่คุณส่งมา */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                   {[
                     { id: 'all', label: 'ทั้งหมด', val: crewSummary.total, color: 'border-blue-600', icon: '👥' },
                     { id: 'ok', label: 'ครบถ้วน', val: crewSummary.ok, color: 'border-emerald-500', icon: '✅' },
                     { id: 'warning', label: 'ใกล้หมด', val: crewSummary.warning, color: 'border-orange-500', icon: '⚠️' },
                     { id: 'action', label: 'ต้องดำเนินการ', val: crewSummary.action, color: 'border-red-600', icon: '🚨' },
                     { id: '90days', label: '90 วัน', val: crewSummary.days90, color: 'border-amber-400', icon: '📋' },
                     { id: 'expired', label: 'หมดแล้ว', val: crewSummary.expired, color: 'border-red-500', icon: '❌' }
                   ].map(tile => (
                     <button key={tile.id} onClick={() => setFilterMode(tile.id)} className={`bg-white p-4 rounded-2xl border-t-4 ${tile.color} shadow-lg flex flex-col items-center justify-center transition-all active:scale-95 ${filterMode === tile.id ? 'ring-4 ring-blue-500/20' : 'opacity-80'}`}>
                        <p className="text-2xl font-black text-slate-900">{tile.val}</p>
                        <p className="text-[9px] font-bold text-slate-500 mt-1 whitespace-nowrap">{tile.icon} {tile.label}</p>
                     </button>
                   ))}
                </div>

                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                  <input type="text" placeholder="Search crew name..." className="w-full bg-black/50 border border-white/10 p-5 pl-12 rounded-[24px] outline-none focus:border-blue-500 transition-all text-sm font-bold" onChange={(e) => setSearchTerm(e.target.value)} />
                </div>

                <div className="space-y-3">
                  {enhancedCrews.map(crew => (
                    <div key={crew.id} className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-white/5 group transition-all hover:border-blue-500/50" onClick={() => { setEditingCrew(crew); setIsEditCrewOpen(true); }}>
                      <div className="flex-1 flex items-center gap-4 cursor-pointer">
                        <div className="relative w-12 h-12 shrink-0">
                           <svg className="w-full h-full transform -rotate-90"><circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white/5"/><circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray="125" strokeDashoffset={125 - (crew.certData.progress/100)*125} className={crew.certData.progress === 100 ? 'text-emerald-500' : 'text-amber-500'}/></svg>
                           <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black">{crew.certData.progress}%</span>
                        </div>
                        <div>
                          <p className="font-bold text-sm text-white flex items-center gap-2">{crew.full_name} {crew.certData.expired > 0 && <span className="bg-red-500 text-white px-2 py-0.5 rounded text-[8px] animate-pulse">EXP</span>}</p>
                          <p className="text-[9px] text-slate-500 tracking-widest mt-1">{crew.position}</p>
                        </div>
                      </div>
                      <ChevronRight className="text-slate-700 group-hover:text-blue-500"/>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeTab === 'inventory' && <div className="py-20 text-center text-slate-500">Inventory Section Loaded...</div>}
            {activeTab === 'system' && <div className="py-20 text-center text-slate-500">System Section Loaded...</div>}
          </div>
        </div>
      </div>

      {/* 🛠️ MODAL: Edit Crew + CERT DEEP DIVE (คงเดิม) */}
      {isEditCrewOpen && editingCrew && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-slate-900 border border-white/10 rounded-[40px] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/5 p-8 shrink-0">
               <h2 className="text-xl font-black italic">{editingCrew.full_name}</h2>
               <button onClick={() => setIsEditCrewOpen(false)}><X size={24}/></button>
            </div>
            <div className="overflow-y-auto p-8 space-y-8 flex-1">
               <div className="space-y-4">
                  <h3 className="text-blue-500 tracking-widest border-b border-white/5 pb-2">Profile Details</h3>
                  <p className="text-white text-xs">Position: {editingCrew.position}</p>
                  <p className="text-white text-xs">Suit Size: {editingCrew.suit_size || '-'}</p>
                  <p className="text-white text-xs">Boot Size: {editingCrew.boot_size || '-'}</p>
               </div>
               <div className="space-y-4">
                  <h3 className="text-purple-500 tracking-widest border-b border-white/5 pb-2 flex justify-between items-center">Certificate Status <span>{editingCrew.certData.progress}%</span></h3>
                  <div className="space-y-2">
                     {editingCrew.certData.list.map((cert: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center bg-black/30 p-4 rounded-xl border border-white/5">
                           <div className="flex items-center gap-3">
                              {cert.status === 'ok' ? <CheckCircle2 size={16} className="text-emerald-500"/> : cert.status === 'warning' ? <Clock size={16} className="text-amber-500"/> : cert.status === 'expired' ? <AlertTriangle size={16} className="text-red-500"/> : <X size={16} className="text-slate-600"/>}
                              <div>
                                 <p className="text-white text-[10px]">{cert.cert_name}</p>
                                 <p className={`text-[8px] mt-0.5 ${cert.status === 'ok' ? 'text-emerald-500' : cert.status === 'expired' ? 'text-red-500' : 'text-slate-500'}`}>{cert.uploaded ? `Exp: ${cert.uploaded.expiry_date === '2099-12-31' ? 'N/A' : cert.uploaded.expiry_date}` : 'Missing'}</p>
                              </div>
                           </div>
                           {cert.uploaded && <a href={cert.uploaded.file_url} target="_blank" className="p-2 bg-white/5 rounded-lg text-blue-400 hover:bg-blue-600"><Eye size={14}/></a>}
                        </div>
                     ))}
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminSettingsPage() {
  return ( <Suspense fallback={<div>Loading...</div>}><SettingsContent /></Suspense> )
}
