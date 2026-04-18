'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { Search, Key, ChevronRight, ChevronLeft, User, CheckCircle2 } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [crewList, setCrewList] = useState<any[]>([])
  const [inventory, setInventory] = useState<any[]>([])
  const [sizeCharts, setSizeCharts] = useState({ suit: '', boot: '' })
  const [mounted, setMounted] = useState(false)

  // Search States
  const [searchTerm, setSearchTerm] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [formData, setFormData] = useState({
    full_name: '', position: '', pin: '',
    suit_color: '', suit_size: '', boot_size: ''
  })

  useEffect(() => {
    setMounted(true)
    async function initData() {
      // ดึงรายชื่อลูกเรือที่ยังไม่มี PIN (ยังไม่ลงทะเบียน)
      const { data: crews } = await supabase.from('crews').select('*').is('pin', null)
      if (crews) setCrewList(crews)
      const { data: inv } = await supabase.from('ppe_inventory').select('*')
      if (inv) setInventory(inv)
      const { data: settings } = await supabase.from('ppe_settings').select('*').eq('id', 1).single()
      if (settings) setSizeCharts({ suit: settings.suit_chart_url, boot: settings.boot_url })
    }
    initData()
    
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ตัวกรองค้นหาชื่อ
  const filteredCrews = crewList.filter(c => 
    c.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSelectCrew = (crew: any) => {
    setFormData({ ...formData, full_name: crew.full_name, position: crew.position })
    setSearchTerm(crew.full_name)
    setIsDropdownOpen(false)
  }

  const handleFinalSubmit = async () => {
    setLoading(true)
    const { error } = await supabase.from('crews').update({
      pin: formData.pin,
      suit_color: formData.suit_color,
      suit_size: formData.suit_size,
      boot_size: formData.boot_size
    }).eq('full_name', formData.full_name)

    if (!error) router.push('/login')
    setLoading(false)
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      {/* Header */}
      <div className="bg-slate-900 border-b border-white/10 p-6 sticky top-0 z-50">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <button onClick={() => step > 1 ? setStep(step-1) : router.push('/login')} className="p-2 bg-white/5 rounded-full"><ChevronLeft size={20}/></button>
          <div className="text-center">
            <h1 className="text-lg font-black uppercase italic tracking-tighter">Crew Register</h1>
            <p className="text-[9px] text-blue-500 font-bold uppercase">Step {step} of 3</p>
          </div>
          <div className="w-10"></div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-8">
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Searchable Name Select */}
            <div className="space-y-4 relative" ref={dropdownRef}>
              <label className="text-[10px] font-black text-blue-500 uppercase flex items-center gap-2"><User size={14}/> Full Name</label>
              <div className="relative">
                <input 
                  type="text"
                  placeholder="Type to search your name..."
                  className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-blue-500 text-sm"
                  value={searchTerm}
                  onFocus={() => setIsDropdownOpen(true)}
                  onChange={(e) => { setSearchTerm(e.target.value); setIsDropdownOpen(true); }}
                />
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
              </div>
              
              {isDropdownOpen && filteredCrews.length > 0 && (
                <div className="absolute z-[60] w-full mt-2 bg-slate-900 border border-white/10 rounded-2xl max-h-60 overflow-y-auto shadow-2xl backdrop-blur-xl">
                  {filteredCrews.map(c => (
                    <button key={c.id} onClick={() => handleSelectCrew(c)} className="w-full text-left p-4 hover:bg-blue-600 border-b border-white/5 last:border-0 transition-colors">
                      <p className="font-bold text-sm text-white">{c.full_name}</p>
                      <p className="text-[10px] text-slate-400 uppercase">{c.position}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Auto Position */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Position (Auto-filled)</label>
              <div className="w-full bg-black/40 border border-white/5 p-4 rounded-2xl text-sm text-blue-400 font-bold italic">
                {formData.position || 'Select name from list...'}
              </div>
            </div>

            {/* PIN Set */}
            <div className="space-y-4 pt-4 border-t border-white/5">
              <label className="text-[10px] font-black text-blue-500 uppercase flex items-center gap-2"><Key size={14}/> Set 6-Digit PIN</label>
              <input 
                type="password" inputMode="numeric" maxLength={6} placeholder="******" 
                className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-center text-2xl font-black tracking-[0.5em] outline-none focus:border-blue-500"
                value={formData.pin} onChange={(e) => setFormData({...formData, pin: e.target.value.replace(/\D/g, '')})}
              />
            </div>

            <button 
              disabled={!formData.full_name || formData.pin.length !== 6} 
              onClick={() => setStep(2)}
              className="w-full py-5 bg-blue-600 rounded-2xl font-black uppercase text-xs disabled:opacity-20 shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
            >
              Next Step <ChevronRight size={18}/>
            </button>
          </div>
        )}

        {/* Step 2 & 3 คงเดิมตามที่เคยคุยกันไว้... */}
        {step === 2 && (
          <div className="space-y-6">
            <img src={sizeCharts.suit} className="w-full rounded-3xl h-48 object-contain bg-black border border-white/10" />
            <div className="grid grid-cols-2 gap-4">
              <select className="w-full bg-slate-900 border border-white/10 p-4 rounded-xl text-xs" value={formData.suit_color} onChange={(e) => setFormData({...formData, suit_color: e.target.value})}>
                <option value="">-- Color --</option>
                {[...new Set(inventory.filter(i => i.item_name.toLowerCase().includes('suit')).map(i => i.color))].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="w-full bg-slate-900 border border-white/10 p-4 rounded-xl text-xs" value={formData.suit_size} onChange={(e) => setFormData({...formData, suit_size: e.target.value})}>
                <option value="">-- Size --</option>
                {[...new Set(inventory.filter(i => i.item_name.toLowerCase().includes('suit')).map(i => i.size))].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <button disabled={!formData.suit_color || !formData.suit_size} onClick={() => setStep(3)} className="w-full py-5 bg-blue-600 rounded-2xl font-black uppercase text-xs">Next Step</button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <img src={sizeCharts.boot} className="w-full rounded-3xl h-48 object-contain bg-black border border-white/10" />
            <select className="w-full bg-slate-900 border border-white/10 p-5 rounded-2xl text-center text-xl font-black" value={formData.boot_size} onChange={(e) => setFormData({...formData, boot_size: e.target.value})}>
              <option value="">-- Boot Size --</option>
              {[...new Set(inventory.filter(i => i.item_name.toLowerCase().includes('safety boot') && !i.item_name.toLowerCase().includes('rubber')).map(i => i.size))].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button disabled={!formData.boot_size} onClick={handleFinalSubmit} className="w-full py-5 bg-emerald-600 rounded-2xl font-black uppercase text-xs">
              {loading ? 'Registering...' : 'Finish Registration'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
