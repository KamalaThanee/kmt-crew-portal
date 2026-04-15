'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { 
  User, ShieldCheck, Key, Shirt, Footprints, 
  ChevronRight, ChevronLeft, AlertCircle, CheckCircle2, Image as ImageIcon
} from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [crewList, setCrewList] = useState([])
  const [inventory, setInventory] = useState([])
  const [sizeCharts, setSizeCharts] = useState({ suit: '', boot: '' })
  const [mounted, setMounted] = useState(false)
  
  const [formData, setFormData] = useState({
    full_name: '', position: '', pin: '',
    suit_color: '', suit_size: '', boot_size: ''
  })
  const [showConfirm, setShowConfirm] = useState(false)

  // ลำดับมาตรฐานของไซส์เสื้อผ้า
  const sizeOrder = ['XXXS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL']

  useEffect(() => {
    setMounted(true)
    async function initData() {
      const { data: crews } = await supabase.from('crews').select('full_name, position')
      if (crews) setCrewList(crews)

      const { data: inv } = await supabase.from('ppe_inventory').select('*')
      if (inv) setInventory(inv)

      // ดึงรูปจาก Database แทน localStorage เพื่อให้เห็นทุกอุปกรณ์
      const { data: settings } = await supabase.from('ppe_settings').select('*').eq('id', 1).single()
      if (settings) {
        setSizeCharts({ suit: settings.suit_chart_url, boot: settings.boot_url })
      }
    }
    initData()
  }, [])

  const handleNameSelect = (name) => {
    const selected = crewList.find(c => c.full_name === name)
    setFormData({ ...formData, full_name: name, position: selected?.position || '' })
  }

  // ฟังก์ชันช่วยเรียงไซส์ (ตัวเลขเรียงเลข / ตัวอักษรเรียงตาม sizeOrder)
  const sortSizes = (arr) => {
    return [...arr].sort((a, b) => {
      const isNumA = !isNaN(a);
      const isNumB = !isNaN(b);
      if (isNumA && isNumB) return Number(a) - Number(b);
      return sizeOrder.indexOf(String(a).toUpperCase()) - sizeOrder.indexOf(String(b).toUpperCase());
    });
  }

  // กรองข้อมูล
  const suitColors = [...new Set(inventory.filter(i => i.item_name.toLowerCase().includes('suit')).map(i => i.color || i.Color))].sort()
  const suitSizes = sortSizes([...new Set(inventory.filter(i => i.item_name.toLowerCase().includes('suit')).map(i => i.size || i.Size))])
  
  // กรองเฉพาะ Safety Boots (ไม่เอา Rubber Boots)
  const bootSizes = sortSizes([...new Set(inventory.filter(i => 
    i.item_name.toLowerCase().includes('safety boot') && 
    !i.item_name.toLowerCase().includes('rubber')
  ).map(i => i.size || i.Size))])

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
      alert('Registration Completed!')
      router.push('/login')
    }
    setLoading(false)
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      <div className="bg-slate-900 border-b border-white/10 p-6 sticky top-0 z-50">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div className="flex flex-col">
            <h1 className="text-lg font-black uppercase tracking-tighter">Crew Register</h1>
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
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
                <User size={14}/> Select Your Name
              </label>
              <select className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-sm outline-none focus:border-blue-500 appearance-none" value={formData.full_name} onChange={(e) => handleNameSelect(e.target.value)}>
                <option value="">-- Choose Name --</option>
                {crewList.map(c => <option key={c.full_name} value={c.full_name} className="bg-slate-900">{c.full_name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Position (Auto)</label>
              <div className="w-full bg-white/5 border border-white/5 p-4 rounded-2xl text-sm text-blue-400 font-bold">{formData.position || 'Select name...'}</div>
            </div>
            <div className="space-y-4">
              <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
                <Key size={14}/> Set 6-Digit PIN
              </label>
              <input type="text" inputMode="numeric" maxLength={6} placeholder="000000" className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-center text-2xl font-black tracking-[0.5em] outline-none focus:border-blue-500" value={formData.pin} onChange={(e) => setFormData({...formData, pin: e.target.value.replace(/\D/g, '')})} />
            </div>
            <button disabled={!formData.full_name || formData.pin.length !== 6} onClick={() => setStep(2)} className="w-full py-5 bg-blue-600 rounded-2xl font-black uppercase flex items-center justify-center gap-2 disabled:opacity-20 transition-all">Next <ChevronRight size={18}/></button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="bg-white/5 border border-white/10 p-2 rounded-2xl overflow-hidden shadow-2xl">
              {sizeCharts.suit ? (
                <img src={`${sizeCharts.suit}?t=${Date.now()}`} className="w-full rounded-xl object-contain" alt="Suit Chart" />
              ) : (
                <div className="py-12 text-center text-[9px] text-slate-500 uppercase font-black tracking-widest">No Chart Provided</div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase">Color</label>
                <select className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-xs" value={formData.suit_color} onChange={(e) => setFormData({...formData, suit_color: e.target.value})}>
                  <option value="">-- Color --</option>
                  {suitColors.map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase">Size</label>
                <select className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-xs" value={formData.suit_size} onChange={(e) => setFormData({...formData, suit_size: e.target.value})}>
                  <option value="">-- Size --</option>
                  {suitSizes.map(s => <option key={s} value={s} className="bg-slate-900">{s}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 py-5 bg-white/5 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2"><ChevronLeft size={16}/> Back</button>
              <button disabled={!formData.suit_color || !formData.suit_size} onClick={() => setStep(3)} className="flex-[2] py-5 bg-blue-600 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2">Next <ChevronRight size={16}/></button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="bg-white/5 border border-white/10 p-2 rounded-2xl overflow-hidden shadow-2xl">
              {sizeCharts.boot ? (
                <img src={`${sizeCharts.boot}?t=${Date.now()}`} className="w-full rounded-xl object-contain" alt="Boot Chart" />
              ) : (
                <div className="py-12 text-center text-[9px] text-slate-500 uppercase font-black tracking-widest">No Chart Provided</div>
              )}
            </div>
            <div className="space-y-4">
              <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-2">
                <Footprints size={14}/> Select Boot Size (Safety Only)
              </label>
              <select className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-center text-xl font-black" value={formData.boot_size} onChange={(e) => setFormData({...formData, boot_size: e.target.value})}>
                <option value="">-- Select Size --</option>
                {bootSizes.map(s => <option key={s} value={s} className="bg-slate-900">{s}</option>)}
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 py-5 bg-white/5 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2"><ChevronLeft size={16}/> Back</button>
              <button disabled={!formData.boot_size} onClick={() => setShowConfirm(true)} className="flex-[2] py-5 bg-emerald-600 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20">Finish <CheckCircle2 size={16}/></button>
            </div>
          </div>
        )}
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-slate-950/95 z-[100] flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-slate-900 border border-white/10 rounded-[32px] w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-2"><AlertCircle size={32}/></div>
              <h3 className="text-xl font-black uppercase tracking-tight">ยืนยันข้อมูล</h3>
              <p className="text-xs text-slate-400">ระบุไซส์เพื่อใช้เบิกเท่านั้น ไม่สามารถเปลี่ยนได้ภายหลัง</p>
              <div className="bg-white/5 rounded-2xl p-4 text-left space-y-2 border border-white/5">
                <div className="flex justify-between text-[10px] font-bold uppercase"><span className="text-slate-500">Boiler Suit:</span> <span>{formData.suit_color} / {formData.suit_size}</span></div>
                <div className="flex justify-between text-[10px] font-bold uppercase"><span className="text-slate-500">Safety Boots:</span> <span>Size {formData.boot_size}</span></div>
              </div>
            </div>
            <div className="p-4 bg-white/5 flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-4 bg-white/5 rounded-2xl font-black uppercase text-[10px]">Back</button>
              <button onClick={handleFinalSubmit} disabled={loading} className="flex-1 py-4 bg-blue-600 rounded-2xl font-black uppercase text-[10px] shadow-lg shadow-blue-500/20">{loading ? 'Saving...' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
