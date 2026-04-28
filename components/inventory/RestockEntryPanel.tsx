import { Loader2, Plus, Save, Trash2, Upload } from 'lucide-react'

type RestockEntry = {
  id: number
  product_key: string
  color: string
  size: string
  inventory_id: string
  qty: string
}

type RestockEntryPanelProps = {
  doNumber: string
  doFile: File | null
  inventory: any[]
  isProcessingRestock: boolean
  restockEntries: RestockEntry[]
  onAddRow: () => void
  onDoFileChange: (file: File | null) => void
  onDoNumberChange: (value: string) => void
  onGenerateDoNumber: () => void
  onRemoveRow: (id: number) => void
  onRestockSubmit: () => void
  onUpdateRow: (id: number, field: string, value: string) => void
}

export function RestockEntryPanel({
  doNumber,
  doFile,
  inventory,
  isProcessingRestock,
  restockEntries,
  onAddRow,
  onDoFileChange,
  onDoNumberChange,
  onGenerateDoNumber,
  onRemoveRow,
  onRestockSubmit,
  onUpdateRow,
}: RestockEntryPanelProps) {
  return (
    <div className="space-y-12 animate-in fade-in max-w-4xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 rounded-[32px] border border-emerald-500/20 bg-emerald-500/10 p-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-emerald-300 ml-2 tracking-[0.2em] block">DO Number</label>
          <input value={doNumber} onChange={(e) => onDoNumberChange(e.target.value)} placeholder="Enter DO number or leave blank for auto" className="w-full bg-black/60 border border-emerald-500/20 p-5 rounded-3xl outline-none text-white font-black text-sm focus:border-emerald-500 uppercase" />
        </div>
        <button onClick={onGenerateDoNumber} className="rounded-3xl border border-emerald-400/30 px-6 py-4 text-[10px] font-black text-emerald-200 hover:bg-emerald-500 hover:text-white transition-all">
          Auto Number
        </button>
      </div>

      <div className="space-y-6">
        {restockEntries.map((entry) => (
          <div key={entry.id} className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center bg-black/50 p-6 rounded-[32px] border border-white/5 group hover:border-emerald-500/30 transition-all">
            <div className="md:col-span-4">
              <select value={entry.product_key} onChange={(e) => onUpdateRow(entry.id, 'product_key', e.target.value)} className="w-full bg-transparent text-base text-white font-black outline-none p-2 uppercase">
                <option value="">-- Select Product --</option>
                {[...new Map(inventory.map((item) => [`${item.category}||${item.item_name}`, item])).values()].map((item) => (
                  <option key={`${item.category}||${item.item_name}`} value={`${item.category}||${item.item_name}`} className="bg-zinc-900">{item.category} | {item.item_name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <select value={entry.color} onChange={(e) => onUpdateRow(entry.id, 'color', e.target.value)} className="w-full bg-transparent text-base text-white font-black outline-none p-2 uppercase">
                <option value="">-- Color --</option>
                {[...new Set(inventory.filter((item) => `${item.category}||${item.item_name}` === entry.product_key).map((item) => item.color).filter(Boolean))].map((color) => (
                  <option key={color} value={color} className="bg-zinc-900">{color}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <select value={entry.size} onChange={(e) => onUpdateRow(entry.id, 'size', e.target.value)} className="w-full bg-transparent text-base text-white font-black outline-none p-2 uppercase">
                <option value="">-- Size --</option>
                {[...new Set(
                  inventory
                    .filter((item) => `${item.category}||${item.item_name}` === entry.product_key)
                    .filter((item) => !entry.color || String(item.color || '') === entry.color)
                    .map((item) => item.size)
                    .filter(Boolean)
                )].map((size) => (
                  <option key={size} value={size} className="bg-zinc-900">{size}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3"><input type="number" min="1" placeholder="QTY" value={entry.qty} onChange={(e) => onUpdateRow(entry.id, 'qty', e.target.value)} className="w-full bg-zinc-950 border-2 border-emerald-500/20 p-5 rounded-2xl text-center font-black text-emerald-400 outline-none focus:border-emerald-500 text-2xl" /></div>
            <div className="md:col-span-1 flex justify-center"><button onClick={() => onRemoveRow(entry.id)} className="text-zinc-800 hover:text-red-500 p-4 bg-white/5 rounded-2xl transition-colors"><Trash2 size={24}/></button></div>
          </div>
        ))}
        <button onClick={onAddRow} className="w-full py-5 border-2 border-dashed border-zinc-800 rounded-3xl text-xs font-black uppercase text-zinc-600 hover:border-emerald-500 transition-all flex items-center justify-center gap-3"><Plus size={20}/> Add More Items</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-end pt-12 border-t border-white/10 pb-10">
        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase text-zinc-600 ml-3 tracking-[0.2em] block">Delivery Document</label>
          <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed ${doFile ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-white/10 hover:border-emerald-500/50'} rounded-[32px] cursor-pointer transition-all`}>
            <Upload size={32} className="text-zinc-700"/>
            <p className="text-xs">{doFile ? doFile.name : 'Select Image'}</p>
            <input type="file" className="hidden" accept="image/*" onChange={(e) => onDoFileChange(e.target.files?.[0] || null)} />
          </label>
        </div>
        <button onClick={onRestockSubmit} disabled={isProcessingRestock} className="w-full h-32 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[40px] font-black uppercase shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-4">{isProcessingRestock ? <Loader2 className="animate-spin" size={32}/> : <Save size={32}/>} Receive DO</button>
      </div>
    </div>
  )
}
