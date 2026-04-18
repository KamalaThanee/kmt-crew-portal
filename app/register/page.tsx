'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { 
  User, ShieldCheck, Key, ChevronRight, ChevronLeft, 
  AlertCircle, CheckCircle2, Search, X
} from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [crewList, setCrewList] = useState<any[]>([])
  const [inventory, setInventory] = useState<any[]>([])
  const [sizeCharts, setSizeCharts] = useState({ suit: '', boot: '' })
  const [mounted, setMounted] = useState(false)
  
  // Search State
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [formData, setFormData] = useState({
    full_name: '', position: '', pin: '',
    suit_color: '', suit_size: '', boot_size: ''
  })
  const [showConfirm, setShowConfirm] = useState(false)

  const sizeOrder = ['XXXS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL']

  useEffect(() => {
    setMounted(true)
    async function initData() {
      const { data: crews } = await supabase.from('crews').select('full_name, position').eq('registered', false)
      if (crews) setCrewList(crews)
      const { data: inv } = await supabase.from('ppe_inventory').select('*')
      if (inv) setInventory(inv)
      const { data: settings } = await supabase.from('ppe_settings').select('*').eq('id', 1).single()
      if (settings) setSizeCharts({ suit: settings.suit_chart_url, boot: settings.boot_url })
    }
    initData()

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredCrews = crewList.filter(c => 
    c.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSelectCrew = (crew: any) => {
    setFormData({ ...formData, full_name: crew.full_name, position: crew.position })
    setSearchTerm(crew.full_name)
    setIsOpen(false)
  }

  const sortSizes = (arr: any[]) => {
    return [...arr].sort((a, b) => {
      const isNumA = !isNaN(a); const isNumB = !isNaN(b);
      if (isNumA && isNumB) return Number(a) - Number(b);
      return sizeOrder.indexOf(String(a).toUpperCase()) - sizeOrder.indexOf(String(b).toUpperCase());
    });
  }

  const suitColors = [...new Set(inventory.filter(i => i.item_name.toLowerCase().includes('suit')).map(i => i.color))].sort()
  const suitSizes = sortSizes([...new Set(inventory.filter(i => i.item_name.toLowerCase().includes('suit')).map(i => i.size))])
  const bootSizes = sortSizes([...new Set(inventory.filter(i => i.item_name.toLowerCase().includes('safety boot') && !i.item_name.toLowerCase().includes('rubber')).map(i => i.size))])

  const handleFinalSubmit = async () => {
    setLoading(true)
    const { error } = await supabase.from('crews').update({
      pin: formData.pin,
      suit_color: formData.suit_color,
      suit_size: formData.suit_size,
      boot_size: formData.boot_size,
      registered: true
    }).eq('full_name', formData.full_name)

    if (!error) {
      router.push('/login')
    }
    setLoading(false)
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20">
      <div className="bg-slate-900 border-b border-white/10 p-6 sticky top-0 z-50">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div className="flex flex-col">
            <h1 className="text-lg font-black uppercase tracking-tighter italic">Crew Register</h1>
            <p className="text-[9px] text-blue-500 font-bold tracking-widest uppercase">Step {step} of 3</p>
          </div>
          <div className="flex gap-1.5">
            {[1,2,3].map(i => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${step >= i ? 'w-6 bg-blue-500' : 'w-2 bg-white/10'}`} />
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-8">
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in zoom-in duration-300">
            <div className="space-y-4" ref={dropdownRef}>
              <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
                <Search size={14}/> Search Your Name
              </label>
              <div className="relative">
                <input 
                  type="text"
                  placeholder="Type to search name..."
                  className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-sm outline-none focus:border-blue-500"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setIsOpen(true); }}
                  onFocus={() => setIsOpen(true)}
                />
                {isOpen && filteredCrews.length > 0 && (
                  <div className="absolute z-50 w-full mt-2 bg-slate-900 border border-white/10 rounded-2xl max-h-60 overflow-y-auto shadow-2xl backdrop-blur-xl">
                    {filteredCrews.map(c => (
                      <button key={c.full_name} onClick={() => handleSelectCrew(c)} className="w-full text-left p-4 hover:bg-blue-600 transition-colors border-b border-white/5 last:border-0">
                        <p className="text-sm font-bold">{c.full_name}</p>
                        <p className="text-[10px] text-slate-400 uppercase">{c.position}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Selected Position</label>
              <div className="w-full bg-white/5 border border-white/5 p-4 rounded-2xl text-sm text-blue-400 font-bold">{formData.position || 'Please select name above'}</div>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/5">
              <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
                <Key size={14}/> Set 6-Digit PIN
              </label>
              <input type="password" inputMode="numeric" maxLength={6} placeholder="******" className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-center text-2xl font-black tracking-[0.5em] outline-none focus:border-blue-500" value={formData.pin} onChange={(e) => setFormData({...formData, pin: e.target.value.replace(/\D/g, '')})} />
            </div>

            <button disabled={!formData.full_name || formData.pin.length !== 6} onClick={() => setStep(2)} className="w-full py-5 bg-blue-600 rounded-2xl font-black uppercase text-xs tracking-widest disabled:opacity-20 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20">Next Step <ChevronRight size={18}/></button>
          </div>
        )}

        {/* Step 2 & 3 (คงเดิมแต่ปรับ UI เล็กน้อย) */}
        {step === 2 && (
          <div className="space-y-6 animate-in slide-in-from-right duration-300">
            <img src={sizeCharts.suit} className="w-full rounded-3xl border border-white/10 bg-black h-48 object-contain" alt="Chart" />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase">Color</label>
                <select className="w-full bg-slate-900 border border-white/10 p-4 rounded-xl text-xs outline-none" value={formData.suit_color} onChange={(e) => setFormData({...formData, suit_color: e.target.value})}>
                  <option value="">-- Color --</option>
                  {suitColors.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase">Size</label>
                <select className="w-full bg-slate-900 border border-white/10 p-4 rounded-xl text-xs outline-none" value={formData.suit_size} onChange={(e) => setFormData({...formData, suit_size: e.target.value})}>
                  <option value="">-- Size --</option>
                  {suitSizes.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 py-5 bg-white/5 rounded-2xl font-black uppercase text-[10px] tracking-widest">Back</button>
              <button disabled={!formData.suit_color || !formData.suit_size} onClick={() => setStep(3)} className="flex-[2] py-5 bg-blue-600 rounded-2xl font-black uppercase text-[10px] tracking-widest">Next</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in slide-in-from-right duration-300">
            <img src={sizeCharts.boot} className="w-full rounded-3xl border border-white/10 bg-black h-48 object-contain" alt="Chart" />
            <div className="space-y-4">
              <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Select Safety Boot Size</label>
              <select className="w-full bg-slate-900 border border-white/10 p-5 rounded-2xl text-center text-xl font-black outline-none" value={formData.boot_size} onChange={(e) => setFormData({...formData, boot_size: e.target.value})}>
                <option value="">-- Select --</option>
                {bootSizes.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-6">
              <button onClick={() => setStep(2)} className="flex-1 py-5 bg-white/5 rounded-2xl font-black uppercase text-[10px] tracking-widest">Back</button>
              <button disabled={!formData.boot_size} onClick={() => setShowConfirm(true)} className="flex-[2] py-5 bg-emerald-600 rounded-2xl font-black uppercase text-[10px] tracking-widest">Complete Registration</button>
            </div>
          </div>
        )}
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-slate-950/95 z-[100] flex items-center justify-center p-6 backdrop-blur-xl">
          <div className="bg-slate-900 border border-white/10 rounded-[32px] w-full max-w-sm overflow-hidden shadow-2xl p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mx-auto"><ShieldCheck size={32}/></div>
              <h3 className="text-xl font-black uppercase tracking-tight italic">Confirm Details</h3>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">This cannot be changed later</p>
            </div>
            <div className="bg-black/40 rounded-2xl p-4 space-y-3 border border-white/5">
              <div className="flex justify-between items-center"><span className="text-[9px] font-bold text-slate-500 uppercase">Name</span><span className="text-xs font-bold">{formData.full_name}</span></div>
              <div className="flex justify-between items-center"><span className="text-[9px] font-bold text-slate-500 uppercase">Boiler Suit</span><span className="text-xs font-bold">{formData.suit_color} / {formData.suit_size}</span></div>
              <div className="flex justify-between items-center"><span className="text-[9px] font-bold text-slate-500 uppercase">Safety Boots</span><span className="text-xs font-bold">Size {formData.boot_size}</span></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-4 bg-white/5 rounded-2xl font-black uppercase text-[10px]">Back</button>
              <button onClick={handleFinalSubmit} className="flex-[2] py-4 bg-blue-600 rounded-2xl font-black uppercase text-[10px] shadow-lg shadow-blue-600/20">{loading ? 'Saving...' : 'Confirm Registration'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
