import { Save, X } from 'lucide-react'

type CategoryOption = {
  name: string
  label: string
}

type EditItemModalProps = {
  categoryConfig: CategoryOption[]
  item: any
  generateNextCode: (categoryName: string) => string
  onChange: (item: any) => void
  onClose: () => void
  onSave: () => void
}

export function EditItemModal({
  categoryConfig,
  item,
  generateNextCode,
  onChange,
  onClose,
  onSave,
}: EditItemModalProps) {
  return (
    <div className="fixed inset-0 z-[2000] bg-black/98 flex items-center justify-center p-6 backdrop-blur-xl">
      <div className="bg-zinc-900 border border-orange-500/30 rounded-[56px] w-full max-w-xl p-12 space-y-8 shadow-2xl overflow-y-auto max-h-[92vh] no-scrollbar">
        <div className="flex justify-between items-center border-b border-white/5 pb-8 text-orange-500">
          <h2 className="text-3xl font-black italic uppercase tracking-tighter">Edit Item</h2>
          <button onClick={onClose} className="p-4 bg-white/5 rounded-full hover:bg-red-500 transition-all text-white"><X size={24}/></button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="col-span-2 space-y-2">
            <label className="text-orange-500 font-black ml-2 uppercase text-[9px]">CATEGORY *</label>
            <select className="w-full bg-black border border-white/10 p-5 rounded-3xl outline-none text-white font-black text-sm focus:border-orange-500" value={item.category} onChange={(event) => {
              const newCategory = event.target.value
              onChange({ ...item, category: newCategory, item_id_code: item.id ? item.item_id_code : generateNextCode(newCategory) })
            }}>
              {categoryConfig.map((category) => <option key={category.name} value={category.name}>{category.name}</option>)}
            </select>
          </div>

          <div className="col-span-2 space-y-2">
            <label className="text-zinc-500 font-black ml-2 uppercase text-[9px]">ITEM NAME *</label>
            <input className="w-full bg-black border border-white/10 p-5 rounded-3xl outline-none text-white font-black text-sm focus:border-orange-500" value={item.item_name} onChange={(event) => onChange({ ...item, item_name: event.target.value })}/>
          </div>

          <div className="space-y-2">
            <label className="text-blue-500 font-black ml-2 uppercase text-[9px]">CODE (AUTO)</label>
            <input className="w-full bg-blue-500/10 border border-blue-500/30 p-5 rounded-3xl text-blue-400 font-black italic text-sm" value={item.item_id_code} readOnly />
          </div>

          <div className="space-y-2">
            <label className="text-zinc-500 font-black ml-2 uppercase text-[9px]">UNIT</label>
            <input className="w-full bg-black border border-white/10 p-5 rounded-3xl text-white font-black text-sm" value={item.unit} onChange={(event) => onChange({ ...item, unit: event.target.value })}/>
          </div>

          <div className="space-y-2">
            <label className="text-zinc-500 font-black ml-2 uppercase text-[9px]">COLOR</label>
            <input className="w-full bg-black border border-white/10 p-5 rounded-3xl text-white font-black text-sm" value={item.color} onChange={(event) => onChange({ ...item, color: event.target.value })}/>
          </div>

          <div className="space-y-2">
            <label className="text-zinc-500 font-black ml-2 uppercase text-[9px]">SIZE</label>
            <input className="w-full bg-black border border-white/10 p-5 rounded-3xl text-white font-black text-sm" value={item.size} onChange={(event) => onChange({ ...item, size: event.target.value })}/>
          </div>

          <div className="space-y-2">
            <label className="text-emerald-500 font-black ml-2 uppercase text-[9px]">STOCK QUANTITY</label>
            <input type="number" className="w-full bg-black border border-emerald-500/30 p-5 rounded-3xl outline-none text-emerald-400 font-black text-2xl focus:border-emerald-500" value={item.quantity} onChange={(event) => onChange({ ...item, quantity: event.target.value })}/>
          </div>

          <div className="space-y-2">
            <label className="text-red-500 font-black ml-2 uppercase text-[9px]">LOW ALERT AT</label>
            <input type="number" className="w-full bg-black border border-red-500/30 p-5 rounded-3xl outline-none text-red-400 font-black text-2xl focus:border-red-500" value={item.threshold} onChange={(event) => onChange({ ...item, threshold: event.target.value })}/>
          </div>
        </div>

        <button onClick={onSave} className="w-full py-6 bg-orange-600 hover:bg-orange-500 text-white rounded-[32px] font-black uppercase text-sm shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3"><Save size={24}/> Update Master Data</button>
      </div>
    </div>
  )
}
