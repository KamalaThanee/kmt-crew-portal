'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { 
  Settings, Users, Package, SlidersHorizontal, 
  Loader2, Upload, Edit, RefreshCw, X, Save
} from 'lucide-react'

export default function AdminSettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('inventory')
  const [uploading, setUploading] = useState({ suit: false, boot: false })
  const [sizeCharts, setSizeCharts] = useState({ suit: '', boot: '' })
  const [inventory, setInventory] = useState<any[]>([])
  const [crews, setCrews] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  
  // Edit Crew State
  const [editingCrew, setEditingCrew] = useState<any>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const userStr = localStorage.getItem('kmt_user')
      if (!userStr) { router.replace('/login'); return; }
      const user = JSON.parse(userStr)
      const userPos = (user.position || "").toLowerCase()
      const adminRoles = ["safety officer", "chief officer", "barge master"]
      if (!adminRoles.includes(userPos)) {
        toast.error('Access Denied'); router.replace('/ppe'); return;
      }
      await fetchData(); setLoading(false);
    }
    checkAuth()
  }, [])

  const fetchData = async () => {
    const { data: st } = await supabase.from('ppe_settings').select('*').eq('id', 1).single()
    if (st) setSizeCharts({ suit: st.suit_chart_url, boot: st.boot_url })
    const { data: inv } = await supabase.from('ppe_inventory').select('*').order('category')
    if (inv) setInventory(inv)
    const { data: cr } = await supabase.from('crews').select('*').order('full_name')
    if (cr) setCrews(cr)
  }

  const handleUpdateCrew = async () => {
    if (!editingCrew) return;
    const { error } = await supabase.from('crews').update({
      full_name: editingCrew.full_name,
      position: editingCrew.position,
      suit_size: editingCrew.suit_size,
      suit_color: editingCrew.suit_color,
      boot_size: editingCrew.boot_size
    }).eq('id', editingCrew.id)

    if (!error) {
      toast.success('Crew data updated'); setIsEditModalOpen(false); fetchData();
    } else toast.error('Update failed');
  }

  const handleResetPin = async (crewId: string, name: string) => {
    if (!confirm(`Reset PIN for ${name}?`)) return;
    await supabase.from('crews').update({ pin: null, registered: false }).eq('id', crewId)
    toast.success('PIN Reset successfully'); fetchData();
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse">VERIFYING ACCESS...</div>

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pb-32 pt-20 px-4 md:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <h1 className="text-3xl font-black uppercase italic flex items-center gap-3"><Settings className="text-blue-500"/> Admin Panel</h1>
          <button onClick={() => router.push('/ppe')} className="p-3 bg-white/5 rounded-full"><X/></button>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-64 space-y-2 shrink-0 font-black uppercase text-[10px] tracking-widest">
            {['inventory', 'crews', 'system'].map(t => (
              <button key={t} onClick={() => setActiveTab(t)} className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${activeTab === t ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-400'}`}>
                {t === 'inventory' ? <Package size={18}/> : t === 'crews' ? <Users size={18}/> : <SlidersHorizontal size={18}/>} {t} Master
              </button>
            ))}
          </div>

          <div className="flex-1 bg-slate-900 border border-white/10 rounded-[32px] p-6 shadow-2xl min-h-[60vh]">
            {activeTab === 'crews' && (
              <div className="animate-in fade-in space-y-3">
                <input type="text" placeholder="Search Crew..." className="w-full mb-6 bg-black/50 border border-white/10 p-4 rounded-2xl outline-none" onChange={(e) => setSearchTerm(e.target.value)} />
                {crews.filter(c => c.full_name.toLowerCase().includes(searchTerm.toLowerCase())).map(crew => (
                  <div key={crew.id} className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-white/5 group">
                    <div className="cursor-pointer flex-1" onClick={() => { setEditingCrew(crew); setIsEditModalOpen(true); }}>
                      <p className="font-bold text-sm uppercase group-hover:text-blue-400 transition-colors">{crew.full_name}</p>
                      <p className="text-[10px] text-slate-500 uppercase">{crew.position} | {crew.suit_size || 'N/A'}</p>
                    </div>
                    <button onClick={() => handleResetPin(crew.id, crew.full_name)} className="px-4 py-2 bg-amber-500/10 text-amber-500 rounded-xl text-[10px] font-black uppercase"><RefreshCw size={14}/></button>
                  </div>
                ))}
              </div>
            )}
            {/* แท็บอื่นคงเดิม... */}
            {activeTab === 'inventory' && <p className="text-slate-500 text-center py-20 uppercase font-black tracking-widest text-xs">Inventory Data loaded ({inventory.length} items)</p>}
            {activeTab === 'system' && <p className="text-slate-500 text-center py-20 uppercase font-black tracking-widest text-xs">System Settings active</p>}
          </div>
        </div>
      </div>

      {/* 🛠️ Edit Crew Modal */}
      {isEditModalOpen && editingCrew && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-slate-900 border border-white/10 rounded-[32px] w-full max-w-lg p-8 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center"><h2 className="text-xl font-black uppercase italic">Edit Crew Member</h2><button onClick={() => setIsEditModalOpen(false)}><X/></button></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Full Name</label><input className="w-full bg-black/50 p-3 rounded-xl border border-white/10 outline-none" value={editingCrew.full_name} onChange={e => setEditingCrew({...editingCrew, full_name: e.target.value})}/></div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Position</label><input className="w-full bg-black/50 p-3 rounded-xl border border-white/10 outline-none" value={editingCrew.position} onChange={e => setEditingCrew({...editingCrew, position: e.target.value})}/></div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Suit Color</label><input className="w-full bg-black/50 p-3 rounded-xl border border-white/10 outline-none" value={editingCrew.suit_color} onChange={e => setEditingCrew({...editingCrew, suit_color: e.target.value})}/></div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Suit Size</label><input className="w-full bg-black/50 p-3 rounded-xl border border-white/10 outline-none" value={editingCrew.suit_size} onChange={e => setEditingCrew({...editingCrew, suit_size: e.target.value})}/></div>
              <div className="col-span-2 space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Boot Size</label><input className="w-full bg-black/50 p-3 rounded-xl border border-white/10 outline-none" value={editingCrew.boot_size} onChange={e => setEditingCrew({...editingCrew, boot_size: e.target.value})}/></div>
            </div>
            <button onClick={handleUpdateCrew} className="w-full py-4 bg-blue-600 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2"><Save size={18}/> Save Changes</button>
          </div>
        </div>
      )}
    </div>
  )
}
