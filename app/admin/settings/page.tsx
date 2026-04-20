'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { 
  Settings, Users, Package, SlidersHorizontal, Search, FileCheck, Clock,
  Loader2, Upload, Edit, RefreshCw, X, Save, AlertTriangle, Box, Plus, ChevronDown, ChevronRight
} from 'lucide-react'
import imageCompression from 'browser-image-compression'

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
  const [filterCat, setFilterCat] = useState('All')
  const [filterStatus, setFilterStatus] = useState('all') // all, expired, ready
  const [expandedCats, setExpandedCats] = useState<string[]>([])

  const [editingCrew, setEditingCrew] = useState<any>(null)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [isEditCrewOpen, setIsEditCrewOpen] = useState(false)
  const [isItemModalOpen, setIsItemModalOpen] = useState(false)

  const sizeOrder = ['XXXS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL']

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
      const userPos = (user.position || "").toLowerCase()
      const adminRoles = ["safety officer", "chief officer", "barge master"]
      if (!adminRoles.includes(userPos)) { toast.error('Access Denied'); router.replace('/ppe'); return; }
      await fetchData(); setLoading(false);
    }
    checkAuth()
  }, [router])

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && ['inventory', 'crews', 'system'].includes(tab)) setActiveTab(tab);
  }, [searchParams])

  // 🎯 ฟังก์ชันวิเคราะห์ Cert รายบุคคล (แบบละเอียด)
  const getCrewCertDetails = (crew: any) => {
    if (certMatrix.length === 0 || allCrewCerts.length === 0) return { progress: 0, expired: 0, list: [] };
    
    const posKey = crew.position ? crew.position.trim().toLowerCase() : "";
    let required = certMatrix.filter(row => {
      const colKey = Object.keys(row).find(k => k.trim().toLowerCase() === posKey);
      return colKey && String(row[colKey]).toUpperCase() === 'P';
    }).map(m => ({ ...m, is_mandatory: true }));

    const crewCerts = allCrewCerts.filter(c => c.crew_id === crew.id);
    
    // Add Triggers
    rules.forEach(rule => {
      if (crewCerts.some(c => c.cert_name === rule.trigger_cert)) {
        if (!required.some(req => req.cert_name === rule.required_cert)) {
          required.push({ cert_name: rule.required_cert, is_mandatory: true })
        }
      }
    })

    const today = new Date();
    let okCount = 0; let expiredCount = 0;
    
    const detailedList = required.map(req => {
      const uploaded = crewCerts.find(c => c.cert_name.trim().toLowerCase() === req.cert_name.trim().toLowerCase());
      let status = 'missing'
      if (uploaded) {
        if (uploaded.expiry_date === '2099-12-31') { status = 'ok'; okCount++; }
        else {
          const expDate = new Date(uploaded.expiry_date)
          if (expDate < today) { status = 'expired'; expiredCount++; }
          else if ((expDate.getTime() - today.getTime())/86400000 <= 90) { status = 'warning'; okCount++; }
          else { status = 'ok'; okCount++; }
        }
      }
      return { ...req, uploaded, status }
    })

    const progress = required.length > 0 ? Math.round((okCount / required.length) * 100) : 0;
    return { progress, expired: expiredCount, list: detailedList };
  }

  // 🎯 ประกอบร่างข้อมูล Crew + Certs เพื่อนำไปใช้ Filter และ Display
  const enhancedCrews = useMemo(() => {
    return crews.map(crew => {
      const certData = getCrewCertDetails(crew);
      return { ...crew, certData };
    }).filter(crew => {
      const matchesSearch = crew.full_name.toLowerCase().includes(searchTerm.toLowerCase());
      const isExpired = crew.certData.expired > 0 || crew.certData.progress < 100;
      const matchesStatus = filterStatus === 'all' || (filterStatus === 'expired' ? isExpired : !isExpired);
      return matchesSearch && matchesStatus;
    })
  }, [crews, searchTerm, filterStatus, certMatrix, allCrewCerts])

  // คำนวณสถิติ Crew Overview
  const crewOverview = useMemo(() => {
    const total = enhancedCrews.length;
    const missingAction = enhancedCrews.filter(c => c.certData.expired > 0 || c.certData.progress < 100).length;
    return { total, ready: total - missingAction, missingAction }
  }, [enhancedCrews])

  const handleUpdateCrew = async () => {
    const { error } = await supabase.from('crews').update({
      full_name: editingCrew.full_name, position: editingCrew.position,
      suit_size: editingCrew.suit_size, suit_color: editingCrew.suit_color, boot_size: editingCrew.boot_size
    }).eq('id', editingCrew.id)
    if (!error) { toast.success('Profile Updated'); setIsEditCrewOpen(false); fetchData(); }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse uppercase">Loading Admin Panel...</div>

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pb-32 pt-20 px-4 md:px-8 text-[10px] uppercase font-bold">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <h1 className="text-3xl font-black italic flex items-center gap-3"><Settings className="text-blue-500"/> Admin Center</h1>
          <button onClick={() => router.push('/admin/dashboard')} className="p-3 bg-white/5 rounded-full"><X/></button>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-64 space-y-2 shrink-0">
            {['inventory', 'crews', 'system'].map(t => (
              <button key={t} onClick={() => setActiveTab(t)} className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${activeTab === t ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                {t === 'inventory' ? <Package size={18}/> : t === 'crews' ? <Users size={18}/> : <SlidersHorizontal size={18}/>} {t} Master
              </button>
            ))}
          </div>

          <div className="flex-1 bg-slate-900 border border-white/10 rounded-[32px] p-6 shadow-2xl min-h-[60vh]">
            
            {/* 🎯 CREW MASTER TAB WITH DASHBOARD */}
            {activeTab === 'crews' && (
              <div className="animate-in fade-in space-y-6">
                <h2 className="text-xl font-black italic text-white mb-4">Crew Master</h2>
                
                {/* Crew Mini Dashboard */}
                <div className="grid grid-cols-3 gap-4 bg-black/30 p-4 rounded-2xl border border-white/5">
                   <div className="text-center p-3"><p className="text-3xl font-black text-blue-500">{crewOverview.total}</p><p className="text-[8px] text-slate-500">Total Crew</p></div>
                   <div className="text-center p-3 border-l border-white/5"><p className="text-3xl font-black text-emerald-500">{crewOverview.ready}</p><p className="text-[8px] text-slate-500">100% Ready</p></div>
                   <div className="text-center p-3 border-l border-white/5"><p className="text-3xl font-black text-red-500">{crewOverview.missingAction}</p><p className="text-[8px] text-slate-500">Action Required</p></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input type="text" placeholder="Search crew name..." className="w-full bg-black/50 border border-white/10 p-4 rounded-2xl outline-none focus:border-blue-500" onChange={(e) => setSearchTerm(e.target.value)} />
                  <select className="w-full bg-black/50 border border-white/10 p-4 rounded-2xl outline-none" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                     <option value="all">All Crews</option>
                     <option value="expired">Action Required (Missing/Expired)</option>
                     <option value="ready">100% Compliant</option>
                  </select>
                </div>

                <div className="space-y-3">
                  {enhancedCrews.map(crew => (
                    <div key={crew.id} className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-white/5 group">
                      <div className="cursor-pointer flex-1 flex items-center gap-4" onClick={() => { setEditingCrew(crew); setIsEditCrewOpen(true); }}>
                        <div className="relative w-12 h-12 shrink-0">
                           <svg className="w-full h-full transform -rotate-90"><circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white/5"/><circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray="125" strokeDashoffset={125 - (crew.certData.progress/100)*125} className={crew.certData.progress === 100 ? 'text-emerald-500' : 'text-amber-500'}/></svg>
                           <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black">{crew.certData.progress}%</span>
                        </div>
                        <div>
                          <p className="font-bold text-sm text-white group-hover:text-blue-400 transition-colors flex items-center gap-2">
                             {crew.full_name} 
                             {crew.certData.expired > 0 && <span className="bg-red-500 text-white px-2 py-0.5 rounded text-[8px] animate-pulse">EXP</span>}
                          </p>
                          <p className="text-[9px] text-slate-500 tracking-widest mt-1">{crew.position} | Suit: {crew.suit_size || '-'} | Boot: {crew.boot_size || '-'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {enhancedCrews.length === 0 && <p className="text-center text-slate-600 py-10">No crews found matching filter.</p>}
                </div>
              </div>
            )}

            {/* Inventory and System tabs code... (คงไว้แบบเดิม) */}
            {activeTab === 'inventory' && <div className="py-20 text-center text-slate-500">Inventory Section Active</div>}
            {activeTab === 'system' && <div className="py-20 text-center text-slate-500">System Section Active</div>}
          </div>
        </div>
      </div>

      {/* 🛠️ MODAL: Edit Crew + CERT DEEP DIVE */}
      {isEditCrewOpen && editingCrew && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 flex items-center justify-center p-4 md:p-6 backdrop-blur-md">
          <div className="bg-slate-900 border border-white/10 rounded-[40px] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/5 p-6 md:p-8 shrink-0">
               <h2 className="text-xl font-black italic">{editingCrew.full_name}</h2>
               <button onClick={() => setIsEditCrewOpen(false)} className="p-2 bg-white/5 rounded-full"><X size={20}/></button>
            </div>
            
            <div className="overflow-y-auto p-6 md:p-8 space-y-8 flex-1">
               {/* PPE Sizes Section */}
               <div className="space-y-4">
                  <h3 className="text-blue-500 tracking-widest border-b border-white/5 pb-2">PPE Profile</h3>
                  <div className="grid grid-cols-2 gap-4 text-white">
                    <div className="col-span-2 space-y-1"><label className="text-slate-500">Position</label><input className="w-full bg-black/50 p-3 rounded-xl border border-white/10 outline-none focus:border-blue-500" value={editingCrew.position} onChange={e => setEditingCrew({...editingCrew, position: e.target.value})}/></div>
                    <div className="space-y-1"><label className="text-slate-500">Suit Size</label><input className="w-full bg-black/50 p-3 rounded-xl border border-white/10 outline-none" value={editingCrew.suit_size} onChange={e => setEditingCrew({...editingCrew, suit_size: e.target.value})}/></div>
                    <div className="space-y-1"><label className="text-slate-500">Boot Size</label><input className="w-full bg-black/50 p-3 rounded-xl border border-white/10 outline-none" value={editingCrew.boot_size} onChange={e => setEditingCrew({...editingCrew, boot_size: e.target.value})}/></div>
                  </div>
                  <button onClick={handleUpdateCrew} className="w-full py-4 bg-blue-600 rounded-2xl font-black uppercase text-[10px] shadow-xl active:scale-95 transition-all"><Save size={14} className="inline mr-2"/> Update Profile</button>
               </div>

               {/* Certificates Section */}
               <div className="space-y-4">
                  <h3 className="text-purple-500 tracking-widest border-b border-white/5 pb-2 flex justify-between items-center">
                     Certificate Status
                     <span className={`px-2 py-1 rounded-md text-[8px] ${editingCrew.certData.progress === 100 ? 'bg-emerald-500/20 text-emerald-500' : 'bg-amber-500/20 text-amber-500'}`}>COMPLIANCE {editingCrew.certData.progress}%</span>
                  </h3>
                  <div className="space-y-2">
                     {editingCrew.certData.list.length === 0 && <p className="text-center text-slate-600 py-4">No certificates required.</p>}
                     {editingCrew.certData.list.map((cert: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center bg-black/30 p-3 rounded-xl border border-white/5">
                           <div className="flex items-center gap-3">
                              {cert.status === 'ok' ? <CheckCircle2 size={16} className="text-emerald-500"/> : cert.status === 'warning' ? <Clock size={16} className="text-amber-500"/> : cert.status === 'expired' ? <AlertTriangle size={16} className="text-red-500"/> : <X size={16} className="text-slate-600"/>}
                              <div>
                                 <p className="text-white text-[10px] leading-tight">{cert.cert_name}</p>
                                 <p className={`text-[8px] mt-0.5 ${cert.status === 'ok' ? 'text-emerald-500' : cert.status === 'expired' ? 'text-red-500' : 'text-slate-500'}`}>{cert.uploaded ? `Exp: ${cert.uploaded.expiry_date === '2099-12-31' ? 'N/A' : cert.uploaded.expiry_date}` : 'Missing'}</p>
                              </div>
                           </div>
                           {cert.uploaded && <a href={cert.uploaded.file_url} target="_blank" className="p-2 bg-white/5 rounded-lg text-blue-400 hover:bg-blue-600 hover:text-white"><Eye size={14}/></a>}
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
