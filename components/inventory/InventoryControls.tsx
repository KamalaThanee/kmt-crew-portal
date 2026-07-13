import { AlertTriangle, Archive, Download, Package, Plus, Ruler, Search, type LucideIcon } from 'lucide-react'

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
  onOpenPpeSizeSummary: () => void
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
  onOpenPpeSizeSummary,
  onOpenReceiveStock,
  onSearchTermChange,
  onShowLowStockChange,
  onToggleCat,
}: InventoryControlsProps) {
  return (
    <>
      <div className="mb-7 flex flex-col gap-5 md:mb-8 md:flex-row md:items-center md:justify-between md:gap-6">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-black italic text-[var(--headline)] md:text-4xl">
            <Package className="text-orange-600" size={36}/> Inventory
          </h1>
          <p className="mt-1 tracking-widest text-[var(--subtle)]">Stock control and receive shipment</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:flex md:flex-wrap md:justify-end">
          <button onClick={onExportExcel} className="flex min-h-[56px] w-full items-center justify-center gap-3 rounded-[20px] border border-blue-500/30 bg-blue-600/10 px-4 py-4 text-xs font-black text-blue-500 shadow-lg shadow-blue-500/5 transition-all active:scale-95 md:w-auto md:px-8"><Download size={18}/> Export Excel</button>
          <button onClick={onOpenPpeSizeSummary} className="flex min-h-[56px] w-full items-center justify-center gap-3 rounded-[20px] border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-xs font-black text-amber-700 shadow-lg shadow-amber-500/5 transition-all active:scale-95 dark:text-amber-300 md:w-auto md:px-8"><Ruler size={18}/> PPE Size Summary</button>
          <button onClick={onOpenReceiveStock} className="flex min-h-[56px] w-full items-center justify-center gap-3 rounded-[20px] border border-emerald-500/30 bg-emerald-600/10 px-4 py-4 text-xs font-black text-emerald-700 shadow-lg shadow-emerald-500/5 transition-all active:scale-95 dark:text-emerald-500 md:w-auto md:px-8"><Archive size={18}/> Receive Stock</button>
          <button onClick={onAddItem} className="flex min-h-[56px] w-full items-center justify-center gap-3 rounded-[20px] bg-orange-600 px-4 py-4 text-xs font-black text-white shadow-lg shadow-orange-600/20 transition-all hover:bg-orange-500 active:scale-95 md:w-auto md:px-8"><Plus size={18}/> Add Item</button>
        </div>
      </div>

      <div className="space-y-6 mb-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--subtle)]" size={20}/>
            <input type="text" placeholder="Search item code or name..." className="w-full rounded-[24px] border border-[var(--nav-border)] bg-[var(--surface-strong)] py-4 pl-14 pr-6 text-sm font-bold text-[var(--headline)] outline-none transition-all placeholder:text-[var(--subtle)] focus:border-orange-500" onChange={(event) => onSearchTermChange(event.target.value)} />
          </div>
          <button onClick={() => onShowLowStockChange(!showLowStock)} className={`rounded-[24px] border py-4 text-xs font-black uppercase transition-all flex items-center justify-center gap-3 ${showLowStock ? 'bg-red-500/20 border-red-500 text-red-500 shadow-inner' : 'bg-[var(--surface-strong)] border-[var(--nav-border)] text-[var(--subtle)] hover:text-red-500'}`}><AlertTriangle size={18}/> {showLowStock ? 'Low Stock Only' : 'Filter Low Stock'}</button>
        </div>

        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-2">
          {categoryConfig.map((category) => {
            const Icon = category.icon
            const isActive = selectedCats.includes(category.name)

            return (
              <button key={category.name} onClick={() => onToggleCat(category.name)} className={`flex h-[80px] min-w-[72px] flex-col items-center justify-center gap-2 rounded-2xl border transition-all md:min-w-[70px] ${isActive ? 'scale-105 border-orange-400 bg-orange-600 text-white shadow-lg shadow-orange-600/30' : 'border-[var(--nav-border)] bg-[var(--surface-strong)] text-[var(--subtle)] hover:border-orange-300 hover:text-orange-600'}`}>
                <Icon size={24} /><span className="text-[8px] font-black uppercase tracking-widest">{category.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
