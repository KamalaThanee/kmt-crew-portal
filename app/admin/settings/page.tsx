'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isAdminRole } from '@/lib/roles'
import { isCrewActive, smartSort, type CrewStatusFilter } from '@/lib/settings'
import { CrewCard } from '@/components/settings/CrewCard'
import { CrewStatusFilterTabs } from '@/components/settings/CrewStatusFilterTabs'
import { toast } from 'sonner'
import { 
  Settings, Search, UserPlus,
  RefreshCw, X, Save, Trash2
} from 'lucide-react'

function SettingsContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<any[]>([]);
  const [crews, setCrews] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [crewStatusFilter, setCrewStatusFilter] = useState<CrewStatusFilter>('active');

  const [editingCrew, setEditingCrew] = useState<any>(null);
  const [isEditCrewOpen, setIsEditCrewOpen] = useState(false);

  const fetchData = async () => {
    const [invRes, crewRes] = await Promise.all([
      supabase.from('ppe_inventory').select('*').order('item_name'),
      supabase.from('crews').select('*').order('full_name')
    ]);
    if (invRes.data) setInventory(invRes.data);
    if (crewRes.data) setCrews(crewRes.data);
    setLoading(false);
  };

  useEffect(() => {
    const checkAuth = async () => {
      const userStr = localStorage.getItem('kmt_user');
      if (!userStr) { router.replace('/login'); return; }
      const user = JSON.parse(userStr);
      if (!isAdminRole(user.position)) { router.replace('/ppe'); return; }
      await fetchData();
    };
    checkAuth();
  }, [router]);

  // 🎯 สกัดตัวเลือกสำหรับ Dropdowns จากสต๊อกจริง
  const suitColors = useMemo(() => [...new Set(inventory.filter(i => i.item_name.toLowerCase().includes('suit')).map(i => i.color))].filter(Boolean).sort(), [inventory])
  const suitSizes = useMemo(() => smartSort([...new Set(inventory.filter(i => i.item_name.toLowerCase().includes('suit')).map(i => i.size))].filter(Boolean)), [inventory])
  const bootSizes = useMemo(() => smartSort([...new Set(inventory.filter(i => i.item_name.toLowerCase().includes('safety boot') && !i.item_name.toLowerCase().includes('rubber')).map(i => i.size))].filter(Boolean)), [inventory])

  const filteredCrews = useMemo(() => {
    return crews.filter(crew => {
      const matchesSearch = crew.full_name.toLowerCase().includes(searchTerm.toLowerCase());
      const active = isCrewActive(crew);
      const matchesStatus =
        crewStatusFilter === 'all' ||
        (crewStatusFilter === 'active' && active) ||
        (crewStatusFilter === 'resigned' && !active);
      return matchesSearch && matchesStatus;
    });
  }, [crews, searchTerm, crewStatusFilter]);

  const handleSaveCrew = async () => {
    if (!editingCrew.full_name || !editingCrew.position) return toast.error('Full Name and Position required');
    
    // บันทึกข้อมูลลงฐานข้อมูล (ใช้ upsert เพื่อรองรับทั้งการเพิ่มและแก้ไข)
    const { error } = await supabase.from('crews').upsert({
      id: editingCrew.id || undefined,
      full_name: editingCrew.full_name,
      position: editingCrew.position,
      suit_color: editingCrew.suit_color,
      suit_size: editingCrew.suit_size,
      boot_size: editingCrew.boot_size,
      is_active: editingCrew.is_active ?? true,
      registered: editingCrew.registered || false
    });

    if (!error) { 
      toast.success(editingCrew.id ? 'Member updated' : 'New member added'); 
      setIsEditCrewOpen(false); 
      fetchData(); 
    } else {
      toast.error('Save failed: ' + error.message);
    }
  };

  const handleResetPin = async (id: string, name: string) => {
    if (confirm(`Reset PIN for ${name}? User must register again.`)) {
      await supabase.from('crews').update({ pin: null, registered: false }).eq('id', id);
      fetchData(); toast.success('PIN has been reset');
    }
  };

  const handleArchiveCrew = async (crew: any) => {
    if (!crew?.id) return
    if (!confirm(`Mark ${crew.full_name} as resigned? They will be hidden from login, registration, and direct issue lists, but history will remain.`)) return

    const admin = JSON.parse(localStorage.getItem('kmt_user') || '{}')
    const { error } = await supabase
      .from('crews')
      .update({
        is_active: false,
        resigned_at: new Date().toISOString(),
        resigned_by: admin.full_name || 'Admin',
        pin: null,
        registered: false,
      })
      .eq('id', crew.id)

    if (error) {
      const message = String(error.message || '').toLowerCase()
      if (message.includes('is_active') || message.includes('resigned_at') || message.includes('schema cache')) {
        return toast.error('Run sql/crew_archive.sql in Supabase first, then try again.')
      }
      return toast.error('Archive failed: ' + error.message)
    }

    toast.success(`${crew.full_name} marked as resigned`)
    setIsEditCrewOpen(false)
    fetchData()
  }

  const handleRestoreCrew = async (crew: any) => {
    if (!crew?.id) return
    if (!confirm(`Restore ${crew.full_name} to active crew list?`)) return

    const { error } = await supabase
      .from('crews')
      .update({ is_active: true, resigned_at: null, resigned_by: null })
      .eq('id', crew.id)

    if (error) return toast.error('Restore failed: ' + error.message)
    toast.success(`${crew.full_name} restored`)
    setIsEditCrewOpen(false)
    fetchData()
  }

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-orange-500 font-black animate-pulse uppercase">Admin Hub Loading...</div>;

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-32 pt-10 md:pt-24 px-4 md:px-12 uppercase font-bold text-[10px]">
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-10 flex justify-between items-center">
          <h1 className="text-4xl font-black italic flex items-center gap-4 tracking-tighter text-white"><Settings className="text-orange-500" size={36}/> Admin Panel</h1>
          <button onClick={() => router.push('/admin/dashboard')} className="p-4 bg-zinc-900 rounded-full border border-white/5 hover:bg-orange-600 transition-all shadow-xl"><X size={24}/></button>
        </div>

        <div className="bg-zinc-900/5 border border-white/5 rounded-[48px] p-8 shadow-inner min-h-[70vh]">
              <div className="animate-in fade-in space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div>
                    <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter leading-none">Barge Crew Master</h2>
                    <p className="text-zinc-600 mt-2">{filteredCrews.length} Personnel in current view</p>
                  </div>
                  {/* 🎯 ปุ่มเพิ่มลูกเรือใหม่ */}
                  <button onClick={() => { setEditingCrew({ full_name: '', position: '', suit_color: '', suit_size: '', boot_size: '', registered: false }); setIsEditCrewOpen(true); }} className="px-8 py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl flex items-center gap-3 active:scale-95 transition-all shadow-lg shadow-orange-600/20"><UserPlus size={18}/> Add New Barge Crew</button>
                </div>
                
                <div className="relative">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600" size={20}/>
                  <input type="text" placeholder="Search by name..." className="w-full bg-black/50 border border-white/10 p-5 pl-14 rounded-[24px] outline-none text-sm font-bold text-white focus:border-orange-500 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>

                <CrewStatusFilterTabs value={crewStatusFilter} onChange={setCrewStatusFilter} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredCrews.map(crew => (
                    <CrewCard key={crew.id} crew={crew} onClick={(selectedCrew) => { setEditingCrew(selectedCrew); setIsEditCrewOpen(true); }} />
                  ))}
                </div>
              </div>
        </div>
      </div>

      {/* 🛠️ MODAL: MANAGE CREW MEMBER */}
      {isEditCrewOpen && editingCrew && (
        <div className="fixed inset-0 z-[1000] bg-black/95 flex items-center justify-center p-6 backdrop-blur-xl animate-in zoom-in duration-300">
          <div className="bg-zinc-900 border border-orange-500/20 rounded-[48px] w-full max-w-xl p-12 space-y-8 shadow-2xl max-h-[92vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center border-b border-white/5 pb-8 mb-4 text-orange-500">
               <h2 className="text-3xl font-black italic uppercase tracking-tighter">{editingCrew.id ? 'Edit Profile' : 'New Member'}</h2>
               <button onClick={() => setIsEditCrewOpen(false)} className="p-3 bg-white/5 rounded-full hover:bg-red-500 text-white transition-all"><X size={24}/></button>
            </div>
            <div className="space-y-6">
              <div className="space-y-2"><label className="text-zinc-500 text-[10px] font-black tracking-widest ml-2 uppercase">FULL NAME *</label><input className="w-full bg-black border border-white/10 p-5 rounded-2xl text-white font-bold text-sm focus:border-orange-500" value={editingCrew.full_name} onChange={e => setEditingCrew({...editingCrew, full_name: e.target.value})}/></div>
              <div className="space-y-2"><label className="text-zinc-500 text-[10px] font-black tracking-widest ml-2 uppercase">POSITION *</label><input className="w-full bg-black border border-white/10 p-5 rounded-2xl text-orange-500 font-black italic text-sm focus:border-orange-500" value={editingCrew.position} onChange={e => setEditingCrew({...editingCrew, position: e.target.value})}/></div>
              
              <div className="space-y-4 pt-4 border-t border-white/5">
                <p className="text-orange-500 text-[10px] font-black tracking-widest ml-2 uppercase">PPE Configuration</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><label className="text-zinc-600 text-[10px] font-bold ml-2">SUIT COLOR</label><select className="w-full bg-black border border-white/10 p-5 rounded-2xl text-white font-bold text-xs" value={editingCrew.suit_color || ''} onChange={e => setEditingCrew({...editingCrew, suit_color: e.target.value})}><option value="">-- Color --</option>{suitColors.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                  <div className="space-y-2"><label className="text-zinc-600 text-[10px] font-bold ml-2">SUIT SIZE</label><select className="w-full bg-black border border-white/10 p-5 rounded-2xl text-white font-bold text-xs" value={editingCrew.suit_size || ''} onChange={e => setEditingCrew({...editingCrew, suit_size: e.target.value})}><option value="">-- Size --</option>{suitSizes.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                </div>
                <div className="space-y-2"><label className="text-zinc-600 text-[10px] font-bold ml-2">SAFETY BOOT SIZE</label><select className="w-full bg-black border border-white/10 p-5 rounded-2xl text-white font-bold text-xs" value={editingCrew.boot_size || ''} onChange={e => setEditingCrew({...editingCrew, boot_size: e.target.value})}><option value="">-- Select Size --</option>{bootSizes.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
              </div>

              <div className="flex gap-4 pt-6">
                 <button onClick={handleSaveCrew} className="flex-[2] py-5 bg-orange-600 hover:bg-orange-500 text-white rounded-3xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"><Save size={18}/> {editingCrew.id ? 'Save Profile' : 'Create Account'}</button>
                 {editingCrew.id && (
                    <button onClick={() => handleResetPin(editingCrew.id, editingCrew.full_name)} className="flex-1 py-5 bg-zinc-800 border border-white/5 rounded-3xl font-black uppercase text-[10px] text-zinc-500 hover:bg-red-600 hover:text-white transition-all">Reset PIN</button>
                 )}
              </div>
              {editingCrew.id && (
                isCrewActive(editingCrew) ? (
                  <button onClick={() => handleArchiveCrew(editingCrew)} className="w-full py-4 bg-red-500/10 border border-red-500/20 rounded-3xl font-black uppercase text-[10px] text-red-400 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-3">
                    <Trash2 size={16}/> Mark as Resigned
                  </button>
                ) : (
                  <button onClick={() => handleRestoreCrew(editingCrew)} className="w-full py-4 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl font-black uppercase text-[10px] text-emerald-400 hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center gap-3">
                    <RefreshCw size={16}/> Restore Active Crew
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminSettingsPage() { return ( <Suspense fallback={<div>Loading...</div>}><SettingsContent /></Suspense> ) }
