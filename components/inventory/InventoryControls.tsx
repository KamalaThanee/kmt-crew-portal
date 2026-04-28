import { AlertTriangle, Archive, Download, Package, Plus, Search, type LucideIcon } from 'lucide-react'

type CategoryOption = {
  icon: LucideIcon
  label: string
  name: string
}

type InventoryControlsProps = {
  categoryConfig: CategoryOption[]
  selectedCats: string[]
  showLowStock: boolean
  onAddItem: () => void
  onExportExcel: () => void
  onOpenReceiveStock: () => void
  onSearchTermChange: (value: string) => void
  onShowLowStockChange: (value: boolean) => void
  onToggleCat: (categoryName: string) => void
}

export function InventoryControls({
  categoryConfig,
  selectedCats,
  showLowStock,
  onAddItem,
  onExportExcel,
  onOpenReceiveStock,
  onSearchTermChange,
  onShowLowStockChange,
  onToggleCat,
}: InventoryControlsProps) {
  return (
    <>
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div><h1 className="text-4xl md:text-5xl font-black italic flex items-center gap-4 tracking-tighter text-white"><Package className="text-blue-500" size={40}/> Inventory</h1></div>
        <div className="flex flex-wrap gap-3">
          <button onClick={onExportExcel} className="px-8 py-4 bg-blue-600/10 border border-blue-500/30 text-blue-400 rounded-[20px] font-black text-xs flex items-center gap-3 transition-all active:scale-95 shadow-lg shadow-blue-500/5"><Download size={18}/> Export Excel</button>
          <button onClick={onOpenReceiveStock} className="px-8 py-4 bg-emerald-600/10 border border-emerald-500/30 text-emerald-500 rounded-[20px] font-black text-xs flex items-center gap-3 transition-all active:scale-95 shadow-lg shadow-emerald-500/5"><Archive size={18}/> Receive Stock</button>
          <button onClick={onAddItem} className="px-8 py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-[20px] font-black text-xs flex items-center gap-3 active:scale-95 transition-all shadow-lg shadow-orange-600/20"><Plus size={18}/> Add Item</button>
        </div>
      </div>

      <div className="space-y-6 mb-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600" size={20}/>
            <input type="text" placeholder="Search item code or name..." className="w-full bg-black/60 border border-white/10 rounded-[24px] py-4 pl-14 pr-6 text-white outline-none focus:border-orange-500 transition-all text-sm font-bold" onChange={(event) => onSearchTermChange(event.target.value)} />
          </div>
          <button onClick={() => onShowLowStockChange(!showLowStock)} className={`rounded-[24px] font-black text-xs uppercase flex items-center justify-center gap-3 border transition-all ${showLowStock ? 'bg-red-500/20 border-red-500 text-red-500 shadow-inner' : 'bg-black/40 border-white/10 text-zinc-600 hover:text-red-500'}`}><AlertTriangle size={18}/> {showLowStock ? 'Low Stock Only' : 'Filter Low Stock'}</button>
        </div>

        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-2">
          {categoryConfig.map((category) => {
            const Icon = category.icon
            const isActive = selectedCats.includes(category.name)

            return (
              <button key={category.name} onClick={() => onToggleCat(category.name)} className={`flex flex-col items-center justify-center gap-2 min-w-[70px] h-[80px] rounded-2xl border transition-all ${isActive ? 'bg-orange-600 border-orange-400 text-white scale-105 shadow-lg shadow-orange-600/30' : 'bg-zinc-900 border-white/5 text-zinc-500 hover:border-white/20'}`}>
                <Icon size={24} /><span className="text-[8px] font-black uppercase tracking-widest">{category.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
