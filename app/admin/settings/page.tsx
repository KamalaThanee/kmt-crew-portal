'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { 
  Settings, Users, Package, SlidersHorizontal, 
  ShieldAlert, Loader2, Upload, Search, Edit, RefreshCw
} from 'lucide-react'

export default function AdminSettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('inventory')
  const [uploading, setUploading] = useState({ suit: false, boot: false })
  const [sizeCharts, setSizeCharts] = useState({ suit: '', boot: '' })
  
  // Data States
  const [inventory, setInventory] = useState<any[]>([])
  const [crews, setCrews] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    // 🛡️ SECURITY GUARD: เช็คสิทธิ์การเข้าถึง
    const checkAuth = async () => {
      const userStr = localStorage.getItem('kmt_user')
      if (!userStr) { router.replace('/login'); return; }
      
      const user = JSON.parse(userStr)
      const adminRoles = ["Safety Officer", "Chief Officer", "Barge Master"]
      
      if (!adminRoles.includes(user.position)) {
        toast.error('Access Denied', { description: 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้' })
        router.replace('/ppe')
        return;
      }

      // ถ้าเป็น Admin ค่อยดึงข้อมูล
      await fetchAllData()
      setLoading(false)
    }
    checkAuth()
  }, [router])

  const fetchAllData = async () => {
    // Fetch Settings
    const { data: st } = await supabase.from('ppe_settings').select('*').eq('id', 1).single()
    if (st) setSizeCharts({ suit: st.suit_chart_url, boot: st.boot_url })
    
    // Fetch Inventory
    const { data: inv } = await supabase.from('ppe_inventory').select('*').order('category')
    if (inv) setInventory(inv)

    // Fetch Crews
    const { data: cr } = await supabase.from('crews').select('*').order('full_name')
    if (cr) setCrews(cr)
  }

  // --- Functions for System Tab ---
  const handleUpload = async (type: 'suit' | 'boot', file: File) => {
    if (!file) return;
    setUploading(prev => ({ ...prev, [type]: true }));
    try {
      const fileName = `${type}_chart_${Date.now()}.jpg`;
      await supabase.storage.from('size-charts').upload(fileName, file);
      const { data: { publicUrl } } = supabase.storage.from('size-charts').getPublicUrl(fileName);
      const column = type === 'suit' ? 'suit_chart_url' : 'boot_url';
      await supabase.from('ppe_settings').update({ [column]: publicUrl }).eq('id', 1);
      setSizeCharts(prev => ({ ...prev, [type]: publicUrl }));
      toast.success('อัปเดต Size Chart สำเร็จ');
    } catch (e) { toast.error('อัปโหลดไม่สำเร็จ'); } 
    finally { setUploading(prev => ({ ...prev, [type]: false })); }
  }

  // --- Functions for Crews Tab ---
  const handleResetPin = async (crewId: string, name: string) => {
    if (!confirm(`ยืนยันการรีเซ็ตรหัส PIN ของ ${name} ใช่หรือไม่?`)) return;
    
    const { error } = await supabase.from('crews').update({ pin: null, registered: false }).eq('id', crewId)
    if (error) { toast.error('Error resetting PIN'); return; }
    
    toast.success(`รีเซ็ต PIN ของ ${name} แล้ว! เขาต้องลงทะเบียนใหม่`)
    fetchAllData()
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse"><ShieldAlert className="mr-2"/> VERIFYING ACCESS...</div>

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pb-32 pt-20 px-4 md:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-black uppercase italic text-white flex items-center gap-3"><Settings className="text-blue-500"/> Super Admin Control</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">System Configuration & Management</p>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar Tabs */}
          <div className="w-full md:w-64 space-y-2 shrink-0">
            {[
              { id: 'inventory', name: 'Inventory Master', icon: <Package size={18}/> },
              { id: 'crews', name: 'Crew Management', icon: <Users size={18}/> },
              { id: 'system', name: 'System Config', icon: <SlidersHorizontal size={18}/> }
            ].map(tab => (
              <button 
                key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 p-4 rounded-2xl font-bold text-sm transition-all uppercase tracking-widest ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
              >
                {tab.icon} {tab.name}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="flex-1 bg-slate-900 border border-white/10 rounded-[32px] p-6 md:p-8 shadow-2xl min-h-[60vh]">
            
            {/* 1. Inventory Tab */}
            {activeTab === 'inventory' && (
              <div className="space-y-6 animate-in fade-in">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-black uppercase tracking-tight">Inventory Data</h2>
                  <input type="text" placeholder="Search..." className="bg-black/50 border border-white/10 px-4 py-2 rounded-xl text-sm outline-none focus:border-blue-500" onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="text-slate-500 uppercase font-black text-[10px] tracking-widest border-b border-white/10">
                      <tr><th className="pb-3">Item Name</th><th className="pb-3">Code</th><th className="pb-3">Qty</th><th className="pb-3">Threshold</th><th className="pb-3 text-right">Action</th></tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {inventory.filter(i => i.item_name.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (
                        <tr key={item.id} className="hover:bg-white/5">
                          <td className="py-4 font-bold">{item.item_name} <span className="text-slate-500 ml-2">{item.color} {item.size}</span></td>
                          <td className="py-4 text-slate-400">{item.item_id_code}</td>
                          <td className="py-4 text-blue-400 font-bold">{item.quantity}</td>
                          <td className="py-4 text-slate-400">{item.threshold}</td>
                          <td className="py-4 text-right">
                            <button className="p-2 bg-white/5 text-blue-400 rounded-lg hover:bg-blue-600 hover:text-white transition-colors" title="Edit coming soon"><Edit size={14}/></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 2. Crews Tab */}
            {activeTab === 'crews' && (
              <div className="space-y-6 animate-in fade-in">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-black uppercase tracking-tight">Crew Directory</h2>
                  <input type="text" placeholder="Search Crew..." className="bg-black/50 border border-white/10 px-4 py-2 rounded-xl text-sm outline-none focus:border-blue-500" onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <div className="space-y-3">
                  {crews.filter(c => c.full_name.toLowerCase().includes(searchTerm.toLowerCase())).map(crew => (
                    <div key={crew.id} className="flex flex-col md:flex-row justify-between items-start md:items-center bg-black/40 p-4 rounded-2xl border border-white/5 gap-4">
                      <div>
                        <p className="font-bold text-sm uppercase">{crew.full_name} {crew.registered ? <span className="text-[9px] bg-emerald-500/20 text-emerald-500 px-2 py-0.5 rounded ml-2">Active</span> : <span className="text-[9px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded ml-2">No PIN</span>}</p>
                        <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-1">{crew.position}</p>
                      </div>
                      <div className="flex gap-2 w-full md:w-auto">
                        <button disabled={!crew.registered} onClick={() => handleResetPin(crew.id, crew.full_name)} className="flex-1 md:flex-none px-4 py-2 bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-30">
                          <RefreshCw size={14}/> Reset PIN
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. System Config Tab */}
            {activeTab === 'system' && (
              <div className="space-y-8 animate-in fade-in">
                <h2 className="text-xl font-black uppercase tracking-tight mb-6">System Charts</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {[ {id: 'suit', label: 'Boiler Suit Size Chart'}, {id: 'boot', label: 'Safety Boot Size Chart'} ].map((item: any) => (
                    <div key={item.id} className="p-6 bg-black/40 rounded-3xl border border-white/5 space-y-4">
                      <p className="font-black uppercase tracking-tighter text-sm text-slate-300">{item.label}</p>
                      {sizeCharts[item.id as 'suit' | 'boot'] ? (
                        <img src={sizeCharts[item.id as 'suit' | 'boot']} className="w-full h-40 object-contain bg-black rounded-2xl" alt="Chart" />
                      ) : (
                        <div className="w-full h-40 bg-black rounded-2xl border border-dashed border-white/10 flex items-center justify-center text-slate-600 uppercase font-bold text-[10px]">No Chart</div>
                      )}
                      <label className="flex items-center justify-center w-full h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-xl cursor-pointer transition-all gap-2 font-bold uppercase tracking-widest text-[10px]">
                        {uploading[item.id as 'suit' | 'boot'] ? <Loader2 className="animate-spin" size={16}/> : <Upload size={16}/>}
                        Update Chart
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleUpload(item.id, e.target.files[0])} disabled={uploading[item.id as 'suit' | 'boot']} />
                      </label>
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
