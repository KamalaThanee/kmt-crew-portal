'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { 
  Settings, Users, Package, SlidersHorizontal, 
  ShieldAlert, Loader2, Upload, Edit, RefreshCw, X
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

  useEffect(() => {
    const checkAuth = async () => {
      const userStr = localStorage.getItem('kmt_user')
      if (!userStr) { router.replace('/login'); return; }
      
      const user = JSON.parse(userStr)
      const userPos = (user.position || "").toLowerCase()
      const adminRoles = ["safety officer", "chief officer", "barge master"]
      
      if (!adminRoles.includes(userPos)) {
        toast.error('Access Denied', { description: 'ตำแหน่งของคุณไม่มีสิทธิ์เข้าหน้าตั้งค่า' })
        router.replace('/ppe')
        return;
      }

      await fetchData()
      setLoading(false)
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

  const handleUpload = async (type: 'suit' | 'boot', file: File) => {
    setUploading(prev => ({ ...prev, [type]: true }));
    try {
      const fileName = `${type}_chart_${Date.now()}.jpg`;
      await supabase.storage.from('size-charts').upload(fileName, file);
      const { data: { publicUrl } } = supabase.storage.from('size-charts').getPublicUrl(fileName);
      await supabase.from('ppe_settings').update({ [type === 'suit' ? 'suit_chart_url' : 'boot_url']: publicUrl }).eq('id', 1);
      setSizeCharts(prev => ({ ...prev, [type]: publicUrl }));
      toast.success('Chart updated');
    } catch (e) { toast.error('Upload failed'); } 
    finally { setUploading(prev => ({ ...prev, [type]: false })); }
  }

  const handleResetPin = async (crewId: string, name: string) => {
    if (!confirm(`Reset PIN for ${name}?`)) return;
    await supabase.from('crews').update({ pin: null, registered: false }).eq('id', crewId)
    toast.success('PIN Reset successfully');
    fetchData();
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse">VERIFYING ADMIN ACCESS...</div>

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pb-32 pt-20 px-4 md:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black uppercase italic text-white flex items-center gap-3"><Settings className="text-blue-500"/> Admin Panel</h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Control Center</p>
          </div>
          <button onClick={() => router.push('/ppe')} className="p-3 bg-white/5 rounded-full hover:bg-white/10"><X/></button>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-64 space-y-2 shrink-0 font-black uppercase text-[10px] tracking-widest">
            <button onClick={() => setActiveTab('inventory')} className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${activeTab === 'inventory' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/5 text-slate-400'}`}><Package size={18}/> Inventory Master</button>
            <button onClick={() => setActiveTab('crews')} className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${activeTab === 'crews' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/5 text-slate-400'}`}><Users size={18}/> Crew Management</button>
            <button onClick={() => setActiveTab('system')} className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${activeTab === 'system' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/5 text-slate-400'}`}><SlidersHorizontal size={18}/> System Charts</button>
          </div>

          <div className="flex-1 bg-slate-900 border border-white/10 rounded-[32px] p-6 shadow-2xl min-h-[60vh]">
            {activeTab === 'inventory' && (
              <div className="animate-in fade-in">
                <input type="text" placeholder="Search Inventory..." className="w-full mb-6 bg-black/50 border border-white/10 p-4 rounded-2xl outline-none" onChange={(e) => setSearchTerm(e.target.value)} />
                <div className="overflow-x-auto text-[11px] font-bold uppercase">
                  <table className="w-full text-left border-collapse">
                    <thead className="text-slate-500 border-b border-white/10">
                      <tr><th className="pb-3">Name</th><th className="pb-3 text-right">Qty</th><th className="pb-3 text-right">Action</th></tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {inventory.filter(i => i.item_name.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (
                        <tr key={item.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-4">{item.item_name} <span className="text-blue-500 ml-2">{item.color} {item.size}</span></td>
                          <td className="py-4 text-right text-white">{item.quantity}</td>
                          <td className="py-4 text-right"><button className="p-2 text-blue-400"><Edit size={14}/></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {activeTab === 'crews' && (
              <div className="animate-in fade-in space-y-3">
                <input type="text" placeholder="Search Crew..." className="w-full mb-6 bg-black/50 border border-white/10 p-4 rounded-2xl outline-none" onChange={(e) => setSearchTerm(e.target.value)} />
                {crews.filter(c => c.full_name.toLowerCase().includes(searchTerm.toLowerCase())).map(crew => (
                  <div key={crew.id} className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-white/5">
                    <div>
                      <p className="font-bold text-sm uppercase">{crew.full_name}</p>
                      <p className="text-[10px] text-slate-500 uppercase">{crew.position}</p>
                    </div>
                    <button disabled={!crew.registered} onClick={() => handleResetPin(crew.id, crew.full_name)} className="px-4 py-2 bg-amber-500/10 text-amber-500 rounded-xl text-[10px] font-black uppercase disabled:opacity-20"><RefreshCw size={14}/></button>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'system' && (
              <div className="animate-in fade-in grid grid-cols-1 md:grid-cols-2 gap-6">
                {['suit', 'boot'].map(type => (
                  <div key={type} className="p-4 bg-black/40 rounded-3xl border border-white/5 space-y-4">
                    <p className="font-black uppercase text-[10px] text-slate-500">{type === 'suit' ? 'Boiler Suit Chart' : 'Safety Boot Chart'}</p>
                    <img src={sizeCharts[type as 'suit' | 'boot']} className="w-full h-32 object-contain bg-black rounded-xl" alt="Chart" />
                    <label className="flex items-center justify-center w-full py-3 bg-blue-600 rounded-xl cursor-pointer font-bold text-[10px] uppercase">
                      {uploading[type as 'suit' | 'boot'] ? <Loader2 className="animate-spin"/> : 'Update Chart'}
                      <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(type as 'suit' | 'boot', e.target.files[0])} />
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
