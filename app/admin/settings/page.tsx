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

const normalize = (str: string) => String(str || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('crews');
  const [uploading, setUploading] = useState({ suit: false, boot: false });
  const [sizeCharts, setSizeCharts] = useState({ suit: '', boot: '' });
  const [inventory, setInventory] = useState<any[]>([]);
  const [crews, setCrews] = useState<any[]>([]);
  const [certMatrix, setCertMatrix] = useState<any[]>([]);
  const [allCrewCerts, setAllCrewCerts] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [filterCert, setFilterCert] = useState('all');
  const [editingCrew, setEditingCrew] = useState<any>(null);
  const [isEditCrewOpen, setIsEditCrewOpen] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const [stRes, invRes, crewRes, mxRes, ccRes, ruRes] = await Promise.all([
        supabase.from('ppe_settings').select('*').eq('id', 1).single(),
        supabase.from('ppe_inventory').select('*').order('item_name'),
        supabase.from('crews').select('*').order('full_name'),
        supabase.from('cert_matrix').select('*'),
        supabase.from('crew_certs').select('*'),
        supabase.from('cert_rules').select('*')
      ]);
      if (stRes.data) setSizeCharts({ suit: stRes.data.suit_chart_url || '', boot: stRes.data.boot_url || '' });
      if (invRes.data) setInventory(invRes.data);
      if (crewRes.data) setCrews(crewRes.data);
      if (mxRes.data) setCertMatrix(mxRes.data);
      if (ccRes.data) setAllCrewCerts(ccRes.data);
      if (ruRes.data) setRules(ruRes.data);
      setLoading(false);
    }
    fetchData();
  }, []);

  const getCrewCertDetails = (crew: any) => {
    if (!certMatrix.length) return { progress: 0, expired: 0, warning: 0, list: [] };
    const crewPosNorm = normalize(crew.position);
    let required = certMatrix.filter(row => normalize(row.position) === crewPosNorm && row.requirement_type === 'P').map(m => ({ ...m, is_mandatory: true }));
    const crewCerts = allCrewCerts.filter(c => String(c.crew_id) === String(crew.id));
    const today = new Date();
    let okCount = 0; let expiredCount = 0; let warningCount = 0;
    const detailedList = required.map(req => {
      const uploaded = crewCerts.find(c => normalize(c.cert_name) === normalize(req.cert_name));
      let status = 'missing';
      if (uploaded) {
        if (uploaded.expiry_date === '2099-12-31') { status = 'ok'; okCount++; }
        else {
          const expDate = new Date(uploaded.expiry_date); const diff = (expDate.getTime() - today.getTime())/86400000;
          if (diff < 0) { status = 'expired'; expiredCount++; }
          else if (diff <= 90) { status = 'warning'; warningCount++; okCount++; }
          else { status = 'ok'; okCount++; }
        }
      }
      return { ...req, uploaded, status };
    });
    const progress = required.length > 0 ? Math.round((okCount / required.length) * 100) : 0;
    return { progress, expired: expiredCount, warning: warningCount, list: detailedList };
  };

  const enhancedCrews = useMemo(() => {
    return crews.map(crew => ({ ...crew, certData: getCrewCertDetails(crew) }))
    .filter(crew => {
      const matchesSearch = crew.full_name.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;
      if (filterCert !== 'all') {
        if (!crew.certData.list.some((c:any) => normalize(c.cert_name) === normalize(filterCert) && c.status !== 'missing')) return false;
      }
      if (filterMode === 'all') return true;
      if (filterMode === 'ok') return crew.certData.progress === 100 && crew.certData.expired === 0;
      if (filterMode === 'warning') return crew.certData.warning > 0 && crew.certData.expired === 0;
      if (filterMode === 'expired') return crew.certData.expired > 0;
      return true;
    });
  }, [crews, searchTerm, filterMode, filterCert, certMatrix, allCrewCerts]);

  const allUniqueCerts = useMemo(() => [...new Set(certMatrix.map(m => m.cert_name))].sort(), [certMatrix]);

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-orange-500 font-black animate-pulse">LOADING ADMIN CENTER...</div>;

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-32 pt-24 px-4 md:px-8 text-[10px] uppercase font-bold">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex justify-between items-center"><h1 className="text-3xl font-black italic flex items-center gap-3"><Settings className="text-orange-500"/> Admin Center</h1><button onClick={() => router.push('/admin/dashboard')} className="p-3 bg-white/5 rounded-full hover:bg-white/10"><X/></button></div>
        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-64 space-y-2 shrink-0">
            {['crews', 'inventory', 'system'].map(t => (
              <button key={t} onClick={() => setActiveTab(t)} className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${activeTab === t ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'bg-zinc-900 text-zinc-500 hover:text-orange-400'}`}>
                {t === 'inventory' ? <Package size={18}/> : t === 'crews' ? <Users size={18}/> : <SlidersHorizontal size={18}/>} {t} Master
              </button>
            ))}
          </div>

          <div className="flex-1 bg-zinc-900 border border-white/5 rounded-[32px] p-6 shadow-2xl min-h-[60vh]">
            {activeTab === 'crews' && (
              <div className="animate-in fade-in space-y-8">
                <h2 className="text-xl font-black italic text-white mb-4">Crew Master</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                   {[
                     { id: 'all', label: 'ทั้งหมด', val: crews.length, color: 'border-blue-500', text: 'text-blue-500' },
                     { id: 'ok', label: 'ครบถ้วน', val: enhancedCrews.filter(c => c.certData.progress === 100).length, color: 'border-emerald-500', text: 'text-emerald-500' },
                     { id: 'warning', label: 'ใกล้หมด', val: enhancedCrews.filter(c => c.certData.warning > 0).length, color: 'border-orange-500', text: 'text-orange-500' },
                     { id: 'expired', label: 'หมดแล้ว', val: enhancedCrews.filter(c => c.certData.expired > 0).length, color: 'border-red-500', text: 'text-red-500' }
                   ].map(tile => (
                     <button key={tile.id} onClick={() => setFilterMode(tile.id)} className={`bg-black/40 p-4 rounded-2xl border-t-4 ${tile.color} flex flex-col items-center justify-center transition-all ${filterMode === tile.id ? 'bg-zinc-800' : 'opacity-80'}`}>
                        <p className={`text-2xl font-black ${tile.text}`}>{tile.val}</p>
                        <p className="text-[8px] text-zinc-500 mt-1 uppercase">{tile.label}</p>
                     </button>
                   ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18}/><input type="text" placeholder="Search crew..." className="w-full bg-black/50 border border-white/10 p-4 pl-12 rounded-[24px] outline-none text-white focus:border-orange-500" onChange={(e) => setSearchTerm(e.target.value)} /></div>
                  {/* 🎯 ตกแต่งช่อง Select ให้ตัวหนังสือขาว/ส้มชัดเจน */}
                  <select className="w-full bg-black/80 border border-orange-500/30 p-4 rounded-[24px] outline-none text-orange-500 font-black cursor-pointer appearance-none text-center" value={filterCert} onChange={(e) => setFilterCert(e.target.value)}>
                     <option value="all" className="bg-zinc-900 text-white">🔍 All Certificates</option>
                     {allUniqueCerts.map(c => <option key={c} value={c} className="bg-zinc-900 text-white font-bold">{c}</option>)}
                  </select>
                </div>

                <div className="space-y-3">
                  {enhancedCrews.map(crew => (
                    <div key={crew.id} className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-white/5 group hover:border-orange-500/50 cursor-pointer" onClick={() => { setEditingCrew(crew); setIsEditCrewOpen(true); }}>
                      <div className="flex items-center gap-4"><div className="relative w-12 h-12"><svg className="w-full h-full transform -rotate-90"><circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white/5"/><circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray="125" strokeDashoffset={125 - (crew.certData.progress/100)*125} className={crew.certData.progress === 100 ? 'text-emerald-500' : 'text-orange-500'}/></svg><span className="absolute inset-0 flex items-center justify-center text-[8px] font-black">{crew.certData.progress}%</span></div>
                      <div><p className="font-bold text-sm text-white group-hover:text-orange-500 transition-colors">{crew.full_name}</p><p className="text-[9px] text-zinc-500 uppercase">{crew.position}</p></div></div>
                      <ChevronRight size={18} className="text-zinc-800 group-hover:text-orange-500 transition-all" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminSettingsPage() { return ( <Suspense fallback={<div>Loading...</div>}><SettingsContent /></Suspense> ) }
