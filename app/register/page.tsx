'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { Search, Key, ChevronRight, ChevronLeft, User, ShieldCheck } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [crewList, setCrewList] = useState<any[]>([])
  const [inventory, setInventory] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [formData, setFormData] = useState({ full_name: '', position: '', pin: '', suit_color: '', suit_size: '', boot_size: '' })
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function init() {
      const { data: crews } = await supabase.from('crews').select('*').is('pin', null)
      if (crews) setCrewList(crews)
      const { data: inv } = await supabase.from('ppe_inventory').select('*')
      if (inv) setInventory(inv)
    }
    init()
  }, [])

  const handleFinalSubmit = async () => {
    setLoading(true)
    const { error } = await supabase.from('crews').update({
      pin: formData.pin, suit_color: formData.suit_color, suit_size: formData.suit_size, boot_size: formData.boot_size, registered: true
    }).eq('full_name', formData.full_name)
    if (!error) { toast.success('Registration Complete'); router.push('/login'); }
    setLoading(false)
  }

  const filtered = crewList.filter(c => c.full_name.toLowerCase().includes(searchTerm.toLowerCase()))

  return (
    <div className="min-h-screen bg-black text-white font-sans p-6 flex flex-col items-center">
      <div className="w-full max-w-sm space-y-8 pt-10">
        <div className="flex items-center justify-between">
          <button onClick={() => router.push('/login')} className="p-3 bg-zinc-900 rounded-full border border-white/5"><ChevronLeft/></button>
          <div className="text-right uppercase font-black italic"><p className="text-xl">Crew Register</p><p className="text-[10px] text-orange-500">Step {step} of 3</p></div>
        </div>

        {step === 1 && (
          <div className="space-y-6 animate-in fade-in">
            <div className="space-y-4 relative" ref={dropdownRef}>
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Full Name</label>
              <input type="text" placeholder="Type to search..." value={searchTerm} onFocus={() => setIsDropdownOpen(true)} onChange={(e) => {setSearchTerm(e.target.value); setIsDropdownOpen(true);}} className="w-full bg-zinc-900 border border-white/10 p-4 rounded-2xl outline-none focus:border-orange-500 font-bold" />
              {isDropdownOpen && filtered.length > 0 && (
                <div className="absolute z-50 w-full mt-2 bg-zinc-900 border border-white/10 rounded-2xl max-h-60 overflow-y-auto shadow-2xl">
                  {filtered.map(c => <div key={c.id} onClick={() => {setFormData({...formData, full_name: c.full_name, position: c.position}); setSearchTerm(c.full_name); setIsDropdownOpen(false);}} className="p-4 hover:bg-orange-600 border-b border-white/5 cursor-pointer font-bold uppercase text-xs">{c.full_name}</div>)}
                </div>
              )}
            </div>
            <div className="space-y-4 pt-4 border-t border-white/5">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">PIN Number</label>
              <input type="password" maxLength={6} inputMode="numeric" placeholder="******" value={formData.pin} onChange={(e) => setFormData({...formData, pin: e.target.value.replace(/\D/g, '')})} className="w-full bg-zinc-900 border border-white/10 p-4 rounded-2xl text-center text-3xl font-black tracking-[0.5em] focus:border-orange-500 outline-none" />
            </div>
            <button disabled={!formData.full_name || formData.pin.length !== 6} onClick={() => setStep(2)} className="w-full py-5 bg-orange-600 rounded-3xl font-black uppercase text-xs shadow-xl shadow-orange-600/20 active:scale-95 transition-all">Continue <ChevronRight size={18} className="inline ml-1"/></button>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in">
             <div className="bg-zinc-900 p-8 rounded-[40px] border border-orange-500/20 text-center"><p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-4">Boiler Suit Settings</p><div className="space-y-4">
               <select className="w-full bg-black border border-white/10 p-4 rounded-2xl outline-none text-white font-bold uppercase text-xs" value={formData.suit_color} onChange={(e) => setFormData({...formData, suit_color: e.target.value})}><option value="">Select Color</option>{[...new Set(inventory.filter(i => i.item_name.toLowerCase().includes('suit')).map(i => i.color))].map(c => <option key={c} value={c}>{c}</option>)}</select>
               <select className="w-full bg-black border border-white/10 p-4 rounded-2xl outline-none text-white font-bold uppercase text-xs" value={formData.suit_size} onChange={(e) => setFormData({...formData, suit_size: e.target.value})}><option value="">Select Size</option>{[...new Set(inventory.filter(i => i.item_name.toLowerCase().includes('suit')).map(i => i.size))].sort().map(s => <option key={s} value={s}>{s}</option>)}</select>
             </div></div>
             <button disabled={!formData.suit_size || !formData.suit_color} onClick={() => setStep(3)} className="w-full py-5 bg-orange-600 rounded-3xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Next Step</button>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in">
             <div className="bg-zinc-900 p-8 rounded-[40px] border border-orange-500/20 text-center"><p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-4">Safety Boots Setting</p><select className="w-full bg-black border border-white/10 p-4 rounded-2xl outline-none text-white font-bold uppercase text-xs" value={formData.boot_size} onChange={(e) => setFormData({...formData, boot_size: e.target.value})}><option value="">Select Boot Size</option>{[...new Set(inventory.filter(i => i.item_name.toLowerCase().includes('safety boot') && !i.item_name.toLowerCase().includes('rubber')).map(i => i.size))].sort().map(s => <option key={s} value={s}>{s}</option>)}</select></div>
             <button disabled={!formData.boot_size} onClick={handleFinalSubmit} className="w-full py-5 bg-emerald-600 rounded-3xl font-black uppercase text-xs shadow-xl shadow-emerald-500/20 active:scale-95 transition-all">Complete Account</button>
          </div>
        )}
      </div>
    </div>
  )
}
