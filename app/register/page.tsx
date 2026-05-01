'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { Search, Key, ChevronRight, ChevronLeft, User, ShieldCheck } from 'lucide-react'

const isCrewActive = (crew: any) => crew?.is_active !== false && !crew?.resigned_at

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [crewList, setCrewList] = useState<any[]>([])
  const [inventory, setInventory] = useState<any[]>([])
  const [sizeCharts, setSizeCharts] = useState({ suit: '', boot: '' })
  
  const [searchTerm, setSearchTerm] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [formData, setFormData] = useState({
    id: null as number | null,
    full_name: '',
    position: '',
    pin: '',
    email: '',
    phone: '',
    suit_color: '',
    suit_size: '',
    boot_size: ''
  })
  const dropdownRef = useRef<HTMLDivElement>(null)

  const sizeOrder = ['XXXS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL']

  useEffect(() => {
    async function init() {
      const [cr, inv, st] = await Promise.all([
        supabase.from('crews').select('*').is('pin', null).order('full_name'),
        supabase.from('ppe_inventory').select('*'),
        supabase.from('ppe_settings').select('*').eq('id', 1).single()
      ]);
      if (cr.data) setCrewList(cr.data.filter(isCrewActive))
      if (inv.data) setInventory(inv.data)
      if (st.data) setSizeCharts({ suit: st.data.suit_chart_url || '', boot: st.data.boot_url || '' })
      setLoading(false)
    }
    init()
  }, [])

  const filtered = crewList.filter(c => c.full_name.toLowerCase().includes(searchTerm.toLowerCase()))

  const sortSizes = (arr: any[]) => {
    return [...arr].sort((a, b) => {
      const idxA = sizeOrder.indexOf(String(a).toUpperCase());
      const idxB = sizeOrder.indexOf(String(b).toUpperCase());
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      return String(a).localeCompare(String(b), undefined, {numeric: true});
    });
  }

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  const handleFinalSubmit = async () => {
    setSaving(true)
    if (!formData.id) {
      toast.error('Please select your name from the list')
      setSaving(false)
      return
    }

    const { data, error } = await supabase.from('crews').update({
      pin: formData.pin,
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      suit_color: formData.suit_color,
      suit_size: formData.suit_size,
      boot_size: formData.boot_size,
      registered: true
    }).eq('id', formData.id).select('id').single()

    if (!error && data) {
      toast.success('Registration Complete')
      router.push('/login')
    } else {
      const message = (error?.message || '').toLowerCase()
      if (message.includes('duplicate key') || message.includes('unique')) {
        toast.error('PIN already in use, please choose another PIN')
      } else {
        toast.error(error?.message || 'Error saving data')
      }
    }
    setSaving(false)
  }

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-orange-500 font-black animate-pulse">LOADING...</div>

  return (
    <div className="min-h-screen bg-black text-white font-sans p-6 flex flex-col items-center">
      <div className="w-full max-w-sm space-y-8 pt-10">
        <div className="flex items-center justify-between">
          <button onClick={() => step === 1 ? router.push('/login') : setStep(step - 1)} className="p-3 bg-zinc-900 rounded-full border border-white/5"><ChevronLeft/></button>
          <div className="text-right uppercase font-black italic"><p className="text-xl">Crew Register</p><p className="text-[10px] text-orange-500">Step {step} of 3</p></div>
        </div>

        {step === 1 && (
          <div className="space-y-6 animate-in fade-in">
            <div className="space-y-4 relative" ref={dropdownRef}>
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Full Name</label>
              <input type="text" placeholder="Search your name..." value={searchTerm} onFocus={() => setIsDropdownOpen(true)} onChange={(e) => {setSearchTerm(e.target.value); setIsDropdownOpen(true);}} className="w-full bg-zinc-900 border border-white/10 p-4 rounded-2xl outline-none focus:border-orange-500 font-bold text-sm" />
              {isDropdownOpen && filtered.length > 0 && (
                <div className="absolute z-50 w-full mt-2 bg-zinc-900 border border-white/10 rounded-2xl max-h-60 overflow-y-auto shadow-2xl">
                  {filtered.map(c => <div key={c.id} onClick={() => {setFormData({...formData, id: c.id, full_name: c.full_name, position: c.position}); setSearchTerm(c.full_name); setIsDropdownOpen(false);}} className="p-4 hover:bg-orange-600 border-b border-white/5 cursor-pointer font-bold uppercase text-xs">{c.full_name}</div>)}
                </div>
              )}
            </div>
            <div className="space-y-4 pt-4 border-t border-white/5">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Security PIN</label>
              <input type="password" maxLength={6} inputMode="numeric" placeholder="******" value={formData.pin} onChange={(e) => setFormData({...formData, pin: e.target.value.replace(/\D/g, '')})} className="w-full bg-zinc-900 border border-white/10 p-4 rounded-2xl text-center text-3xl font-black tracking-[0.5em] focus:border-orange-500 outline-none" />
            </div>
            <div className="space-y-4">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Email</label>
              <input type="email" placeholder="name@example.com" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full bg-zinc-900 border border-white/10 p-4 rounded-2xl outline-none focus:border-orange-500 font-bold text-sm" />
            </div>
            <div className="space-y-4">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Phone Number</label>
              <input type="tel" inputMode="numeric" placeholder="08xxxxxxxx" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value.replace(/[^\d+\-\s]/g, '')})} className="w-full bg-zinc-900 border border-white/10 p-4 rounded-2xl outline-none focus:border-orange-500 font-bold text-sm" />
            </div>
            <button disabled={!formData.full_name || formData.pin.length !== 6 || !isValidEmail(formData.email) || formData.phone.trim().length < 9} onClick={() => setStep(2)} className="w-full py-5 bg-orange-600 rounded-3xl font-black uppercase text-xs shadow-xl shadow-orange-600/20 active:scale-95 transition-all disabled:opacity-50">Next Step</button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
             {sizeCharts.suit ? <img src={sizeCharts.suit} className="w-full rounded-[32px] h-48 object-contain bg-zinc-900 border border-white/10 p-2" /> : <div className="w-full h-32 bg-zinc-900 rounded-[32px] flex items-center justify-center text-zinc-600 font-black text-[10px] uppercase border border-white/10">No Chart Found</div>}
             <div className="bg-zinc-900 p-8 rounded-[40px] border border-orange-500/20 text-center space-y-4">
               <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-4">Boiler Suit Settings</p>
               <select className="w-full bg-black border border-white/10 p-4 rounded-2xl outline-none text-white font-bold uppercase text-xs" value={formData.suit_color} onChange={(e) => setFormData({...formData, suit_color: e.target.value})}><option value="">Select Color</option>{[...new Set(inventory.filter(i => i.item_name.toLowerCase().includes('suit')).map(i => i.color))].map(c => <option key={c} value={c}>{c}</option>)}</select>
               <select className="w-full bg-black border border-white/10 p-4 rounded-2xl outline-none text-white font-bold uppercase text-xs" value={formData.suit_size} onChange={(e) => setFormData({...formData, suit_size: e.target.value})}><option value="">Select Size</option>{sortSizes([...new Set(inventory.filter(i => i.item_name.toLowerCase().includes('suit')).map(i => i.size))]).map(s => <option key={s} value={s}>{s}</option>)}</select>
             </div>
             <button disabled={!formData.suit_size || !formData.suit_color} onClick={() => setStep(3)} className="w-full py-5 bg-orange-600 rounded-3xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Next Step</button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
             {sizeCharts.boot ? <img src={sizeCharts.boot} className="w-full rounded-[32px] h-48 object-contain bg-zinc-900 border border-white/10 p-2" /> : <div className="w-full h-32 bg-zinc-900 rounded-[32px] flex items-center justify-center text-zinc-600 font-black text-[10px] uppercase border border-white/10">No Chart Found</div>}
             <div className="bg-zinc-900 p-8 rounded-[40px] border border-orange-500/20 text-center space-y-4">
               <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-4">Safety Boots Setting</p>
               <select className="w-full bg-black border border-white/10 p-4 rounded-2xl outline-none text-white font-bold uppercase text-xs" value={formData.boot_size} onChange={(e) => setFormData({...formData, boot_size: e.target.value})}><option value="">Select Size</option>{sortSizes([...new Set(inventory.filter(i => i.item_name.toLowerCase().includes('safety boot') && !i.item_name.toLowerCase().includes('rubber')).map(i => i.size))]).map(s => <option key={s} value={s}>{s}</option>)}</select>
             </div>
             <button disabled={!formData.boot_size || saving} onClick={handleFinalSubmit} className="w-full py-5 bg-emerald-600 rounded-3xl font-black uppercase text-xs shadow-xl shadow-emerald-500/20 active:scale-95 transition-all">{saving ? 'Saving...' : 'Complete Profile'}</button>
          </div>
        )}
      </div>
    </div>
  )
}
