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
  
  const [formData, setFormData] = useState({
    full_name: '',
    position: '',
    pin: '',
    suit_color: '',
    suit_size: '',
    boot_size: ''
  })
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    async function initData() {
      // 1. ดึงรายชื่อลูกเรือทั้งหมด
      const { data: crews } = await supabase.from('crews').select('full_name, position')
      if (crews) setCrewList(crews)

      // 2. ดึง Stock PPE ทั้งหมดมาทำ Dropdown
      const { data: inv } = await supabase.from('ppe_inventory').select('*')
      if (inv) setInventory(inv)

      // 3. ดึง Size Chart จากที่ตั้งค่าไว้
      const savedCharts = localStorage.getItem('kmt_size_charts')
      if (savedCharts) setSizeCharts(JSON.parse(savedCharts))
    }
    initData()
  }, [])

  // 1. จัดการเลือกชื่อแล้ว Position ขึ้นอัตโนมัติ
  const handleNameSelect = (name) => {
    const selected = crewList.find(c => c.full_name === name)
    setFormData({ ...formData, full_name: name, position: selected?.position || '' })
  }

  // กรองข้อมูล Inventory สำหรับ Dropdown
  const suitColors = [...new Set(inventory.filter(i => i.item_name.toLowerCase().includes('suit')).map(i => i.color || i.Color))]
  const suitSizes = [...new Set(inventory.filter(i => i.item_name.toLowerCase().includes('suit')).map(i => i.size || i.Size))]
  const bootSizes = [...new Set(inventory.filter(i => i.item_name.toLowerCase().includes('boot')).map(i => i.size || i.Size))]

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
    } else {
      alert('Error: ' + error.message)
    }
    setLoading(false)
  }

  const renderStep = () => {
    switch(step) {
      case 1: // ข้อมูลส่วนตัว & PIN
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
                <User size={14}/> Select Your Name
              </label>
              <select 
                className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-sm outline-none focus:border-blue-500"
                value={formData.full_name}
                onChange={(e) => handleNameSelect(e.target.value)}
              >
                <option value="">-- Choose Name --</option>
                {crewList.map(c => <option key={c.full_name} value={c.full_name} className="bg-slate-900">{c.full_name}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Position (Auto)</label>
              <div className="w-full bg-white/5 border border-white/5 p-4 rounded-2xl text-sm text-blue-400 font-bold">
                {formData.position || 'Please select name first'}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
                <Key size={14}/> Set 6-Digit PIN
              </label>
              <input 
                type="text" 
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-center text-2xl font-black tracking-[0.5em] outline-none focus:border-blue-500"
                value={formData.pin}
                onChange={(e) => setFormData({...formData, pin: e.target.value.replace(/\D/g, '')})}
              />
              <p className="text-[9px] text-center text-slate-500">ใช้สำหรับยืนยันตัวตนตอนเบิกอุปกรณ์</p>
            </div>

            <button 
              disabled={!formData.full_name || formData.pin.length !== 6}
              onClick={() => setStep(2)}
              className="w-full py-5 bg-blue-600 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-20 transition-all active:scale-95"
            >
              Next Step <ChevronRight size={18}/>
            </button>
          </div>
        )

      case 2: // Boiler Suit
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="bg-blue-600/10 border border-blue-500/20 p-4 rounded-2xl space-y-3 text-center">
              <h4 className="text-[10px] font-black uppercase text-blue-400 flex items-center justify-center gap-2">
                <ImageIcon size={14}/> Boiler Suit Size Chart
              </h4>
              {sizeCharts.suit ? (
                <img src={sizeCharts.suit} className="w-full rounded-xl shadow-lg border border-white/10" alt="Size Chart" />
              ) : (
                <div className="py-4 text-[9px] text-slate-500 italic">No Size Chart Available</div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase">Color</label>
                <select 
                  className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-xs outline-none focus:border-blue-500"
                  value={formData.suit_color}
                  onChange={(e) => setFormData({...formData, suit_color: e.target.value})}
                >
                  <option value="">-- Color --</option>
                  {suitColors.map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase">Size</label>
                <select 
                  className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-xs outline-none focus:border-blue-500"
                  value={formData.suit_size}
                  onChange={(e) => setFormData({...formData, suit_size: e.target.value})}
                >
                  <option value="">-- Size --</option>
                  {suitSizes.map(s => <option key={s} value={s} className="bg-slate-900">{s}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={() => setStep(1)} className="flex-1 py-5 bg-white/5 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2"><ChevronLeft size={16}/> Back</button>
              <button 
                disabled={!formData.suit_color || !formData.suit_size}
                onClick={() => setStep(3)}
                className="flex-[2] py-5 bg-blue-600 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 disabled:opacity-20"
              >
                Next Step <ChevronRight size={16}/>
              </button>
            </div>
          </div>
        )

      case 3: // Safety Boots
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="bg-amber-600/10 border border-amber-500/20 p-4 rounded-2xl space-y-3 text-center">
              <h4 className="text-[10px] font-black uppercase text-amber-500 flex items-center justify-center gap-2">
                <ImageIcon size={14}/> Safety Boots Size Chart
              </h4>
              {sizeCharts.boot ? (
                <img src={sizeCharts.boot} className="w-full rounded-xl shadow-lg border border-white/10" alt="Size Chart" />
              ) : (
                <div className="py-4 text-[9px] text-slate-500 italic">No Size Chart Available</div>
              )}
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
                <Footprints size={14}/> Select Boot Size
              </label>
              <select 
                className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-center text-xl font-black outline-none focus:border-blue-500"
                value={formData.boot_size}
                onChange={(e) => setFormData({...formData, boot_size: e.target.value})}
              >
                <option value="">-- Select Size --</option>
                {bootSizes.map(s => <option key={s} value={s} className="bg-slate-900">{s}</option>)}
              </select>
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={() => setStep(2)} className="flex-1 py-5 bg-white/5 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2"><ChevronLeft size={16}/> Back</button>
              <button 
                disabled={!formData.boot_size}
                onClick={() => setShowConfirm(true)}
                className="flex-[2] py-5 bg-emerald-600 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 disabled:opacity-20 shadow-lg shadow-emerald-500/20"
              >
                Complete Registration <CheckCircle2 size={16}/>
              </button>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-blue-500/30">
      {/* Step Header */}
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
        {renderStep()}
      </div>

      {/* Confirmation Popup */}
      {showConfirm && (
        <div className="fixed inset-0 bg-slate-950/95 z-[100] flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-white/10 rounded-[32px] w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-2 animate-pulse">
                <AlertCircle size={32}/>
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight">ยืนยันข้อมูล</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                กรุณาเลือกสีและขนาดให้ตรงตามความต้องการ <br/>
                <span className="text-amber-500 font-bold underline">ระบบจะให้เบิกตามไซส์ที่ระบุไว้นี้เท่านั้น</span>
              </p>

              <div className="bg-white/5 rounded-2xl p-4 text-left space-y-2 border border-white/5">
                <div className="flex justify-between text-[10px] font-bold uppercase"><span className="text-slate-500">Boiler Suit:</span> <span>{formData.suit_color} / {formData.suit_size}</span></div>
                <div className="flex justify-between text-[10px] font-bold uppercase"><span className="text-slate-500">Safety Boots:</span> <span>Size {formData.boot_size}</span></div>
              </div>
            </div>

            <div className="p-4 bg-white/5 flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-4 bg-white/5 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-white/10">ย้อนกลับ</button>
              <button 
                onClick={handleFinalSubmit}
                disabled={loading}
                className="flex-1 py-4 bg-blue-600 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
              >
                {loading ? 'Saving...' : 'ยืนยันถูกต้อง'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
