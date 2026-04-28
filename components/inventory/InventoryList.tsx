import { Box, ChevronDown, ChevronRight, Edit } from 'lucide-react'

type InventoryListProps = {
  expandedCats: string[]
  groupedInventory: Record<string, any[]>
  onEditItem: (item: any) => void
  onExpandedCatsChange: (categories: string[]) => void
}

export function InventoryList({
  expandedCats,
  groupedInventory,
  onEditItem,
  onExpandedCatsChange,
}: InventoryListProps) {
  return (
    <div className="space-y-6">
      {Object.entries(groupedInventory).map(([category, items]) => {
        const isExpanded = expandedCats.includes(category)

        return (
          <div key={category} className={`border rounded-[40px] overflow-hidden transition-all duration-300 ${isExpanded ? 'border-orange-500/30 bg-black/40 shadow-2xl' : 'border-white/5 bg-zinc-900/30'}`}>
            <button onClick={() => onExpandedCatsChange(isExpanded ? expandedCats.filter((currentCategory) => currentCategory !== category) : [...expandedCats, category])} className="w-full p-8 flex items-center justify-between outline-none group transition-colors">
              <div className="flex items-center gap-5 text-orange-500 group-hover:scale-105 transition-transform">
                <Box size={32}/>
                <h2 className="text-lg font-black text-white tracking-widest uppercase">{category} ({items.length})</h2>
              </div>
              {isExpanded ? <ChevronDown size={28} className="text-orange-500"/> : <ChevronRight size={28} className="text-zinc-800"/>}
            </button>

            {isExpanded && (
              <div className="overflow-x-auto border-t border-white/5 bg-black/30 p-6">
                <table className="w-full text-left text-[12px] font-black border-separate border-spacing-y-3">
                  <thead className="text-zinc-600">
                    <tr><th className="p-6 pl-8">Code</th><th className="p-6">Item Name</th><th className="p-6 text-center">Spec</th><th className="p-6 text-right">Stock</th><th className="p-6 text-center pr-8">Action</th></tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const isLow = item.quantity <= item.threshold

                      return (
                        <tr key={item.id} className="bg-white/5 hover:bg-orange-600/10 transition-all rounded-2xl group">
                          <td className={`p-6 pl-8 rounded-l-[24px] border-l-4 ${isLow ? 'border-red-500/50' : 'border-transparent group-hover:border-orange-500'} text-zinc-500 font-black`}>{item.item_id_code}</td>
                          <td className="p-6 text-white font-bold">{item.item_name}</td>
                          <td className="p-6 text-center text-blue-400 font-black">{item.color} {item.size}</td>
                          <td className={`p-6 text-right font-black text-xl ${isLow ? 'text-red-500' : 'text-emerald-500'}`}>{item.quantity}</td>
                          <td className="p-6 text-center pr-8 rounded-r-[24px]">
                            <button onClick={() => onEditItem(item)} className="p-3 bg-black/50 border border-white/10 rounded-xl text-orange-400 hover:bg-orange-600 hover:text-white hover:border-orange-500 transition-all">
                              <Edit size={16}/>
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
