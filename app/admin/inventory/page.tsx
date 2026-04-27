'use client'
import { useState, useEffect, useMemo, Suspense, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { 
  Package, Search, AlertTriangle, Download, Plus, Edit, X, Save, 
  Box, ChevronDown, ChevronRight, Archive, FileText, Loader2, 
  CheckCircle2, Trash2, Upload, Clock, User,
  HardHat, Headphones, Eye, Wind, Shirt, Hand, Footprints, MoreHorizontal
} from 'lucide-react'
import imageCompression from 'browser-image-compression'

const normalize = (str: string) => String(str || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();
const sizeOrder = ['XXXS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL']

const compareSize = (a: any, b: any) => {
  const sa = String(a || '').trim().toUpperCase()
  const sb = String(b || '').trim().toUpperCase()

  const freeRank: Record<string, number> = { 'FREE SIZE': 9998, 'FREESIZE': 9998, 'FS': 9998 }
  if (freeRank[sa] !== undefined || freeRank[sb] !== undefined) {
    const ra = freeRank[sa] ?? 10000
    const rb = freeRank[sb] ?? 10000
    if (ra !== rb) return ra - rb
  }

  const idxA = sizeOrder.indexOf(sa)
  const idxB = sizeOrder.indexOf(sb)
  const hasA = idxA !== -1
  const hasB = idxB !== -1
  if (hasA && hasB) return idxA - idxB
  if (hasA) return -1
  if (hasB) return 1

  const numA = Number(sa)
  const numB = Number(sb)
  const isNumA = !Number.isNaN(numA)
  const isNumB = !Number.isNaN(numB)
  if (isNumA && isNumB) return numA - numB
  if (isNumA) return -1
  if (isNumB) return 1

  return sa.localeCompare(sb, undefined, { numeric: true })
}

function InventoryContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [inventory, setInventory] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [stockTransactions, setStockTransactions] = useState<any[]>([])
  const [stockTransactionError, setStockTransactionError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCats, setSelectedCats] = useState<string[]>([])
  const [showLowStock, setShowLowStock] = useState(false)
  const [loading, setLoading] = useState(true)
  const [expandedCats, setExpandedCats] = useState<string[]>([]) // 🎯 เริ่มต้นว่าง และจะถูกเติมหลัง Fetch ข้อมูล

  const [editingItem, setEditingItem] = useState<any>(null)
  const [isItemModalOpen, setIsItemModalOpen] = useState(false)
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false)
  const [restockView, setRestockView] = useState<'entry' | 'history' | 'issue-log'>('entry')

  const [restockEntries, setRestockEntries] = useState([{ id: Date.now(), product_key: '', color: '', size: '', inventory_id: '', qty: '' }])
  const [doFile, setDoFile] = useState<File | null>(null)
  const [isProcessingRestock, setIsProcessingRestock] = useState(false)
  const [isRefreshingTransactions, setIsRefreshingTransactions] = useState(false)

  const fetchStockTransactions = async (showToast = false) => {
    setIsRefreshingTransactions(true)
    setStockTransactionError('')
    try {
      const { data: movements, error: movementsError } = await supabase
        .from('ppe_stock_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (movementsError) {
        const message = movementsError.message || 'Unable to load stock movement log'
        setStockTransactionError(message)
        if (showToast) toast.error(message)
        return
      }

      setStockTransactions(movements || [])
      if (showToast) {
        if ((movements || []).length > 0) toast.success(`Loaded ${movements?.length || 0} issue transactions`)
        else toast.info('No issue transactions yet. Run the SQL backfill if old received requests should appear.')
      }
    } finally {
      setIsRefreshingTransactions(false)
    }
  }

  const fetchData = async () => {
    const { data: inv } = await supabase.from('ppe_inventory').select('*').order('category').order('item_id_code')
    if (inv) {
      setInventory(inv);
      // 🎯 เริ่มต้นให้ขยายทุก Category ที่มีข้อมูล
      const allCats = [...new Set(inv.map((i:any) => i.category).filter(Boolean))];
      setExpandedCats(allCats as string[]);
    }
    const { data: hist } = await supabase.from('restock_history').select('*').order('created_at', { ascending: false })
    if (hist) setHistory(hist)
    await fetchStockTransactions(false)
    setLoading(false)
  }

  useEffect(() => {
    if (searchParams.get('filter') === 'low') setShowLowStock(true)
    
    // 🎯 จัดการคำสั่งจาก Dashboard
    const action = searchParams.get('action');
    const tab = searchParams.get('tab');
    if (action === 'restock') {
      setIsRestockModalOpen(true);
      if (tab === 'history') setRestockView('history');
      else setRestockView('entry');
    }
    fetchData()
  }, [searchParams])

  const categoryConfig = [
    { name: 'Head Protection', icon: HardHat, label: 'Head' },
    { name: 'Ears Protection', icon: Headphones, label: 'Ears' },
    { name: 'Eyes Protection', icon: Eye, label: 'Eyes' },
    { name: 'Respiratory Protection', icon: Wind, label: 'Resp' },
    { name: 'Body Protection', icon: Shirt, label: 'Body' },
    { name: 'Hands Protection', icon: Hand, label: 'Hands' },
    { name: 'Foots Protection', icon: Footprints, label: 'Foots' },
    { name: 'Other', icon: MoreHorizontal, label: 'Other' },
  ]

  const toggleCat = (catName: string) => {
    setSelectedCats(prev => {
      const isSelecting = !prev.includes(catName);
      const newSelected = isSelecting ? [...prev, catName] : prev.filter(c => c !== catName);
      
      // 🎯 ถ้ากดเลือกไอคอนหมวดหมู่ ให้กางหมวดหมู่นั้นออกทันที
      if (isSelecting && !expandedCats.includes(catName)) {
        setExpandedCats(ex => [...ex, catName]);
      }
      return newSelected;
    })
  }

  const generateNextCode = (catName: string) => {
    const catItems = inventory.filter(i => i.category === catName)
    const numbers = catItems.map(i => {
      const match = String(i.item_id_code).match(/(\d+)\s*$/)
      return match ? parseInt(match[1], 10) : 0
    })
    const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1
    const padded = String(nextNumber).padStart(2, '0')

    const prefixMap: Record<string, string> = {
      'Head Protection': 'Head',
      'Ears Protection': 'Ear',
      'Eyes Protection': 'Eye',
      'Respiratory Protection': 'Resp',
      'Body Protection': 'Body',
      'Hands Protection': 'Hand',
      'Foots Protection': 'Foot',
      'Other': 'Other'
    }

    const existingPrefix = catItems
      .map(i => String(i.item_id_code || '').match(/^([A-Za-z]+)-\d+$/)?.[1])
      .find(Boolean)

    const prefix = existingPrefix || prefixMap[catName] || catName.replace(/\s+Protection$/i, '').replace(/\s+/g, '')
    return `${prefix}-${padded}`
  }

  const updateRow = (id: number, field: string, value: string) => {
    setRestockEntries(prev => prev.map(e => {
      if (e.id !== id) return e
      const next = { ...e, [field]: value }

      if (field === 'product_key') {
        next.color = ''
        next.size = ''
        next.inventory_id = ''
      }

      if (field === 'color') {
        next.size = ''
        next.inventory_id = ''
      }

      if (field === 'size') {
        next.inventory_id = ''
      }

      const productItems = inventory.filter(i => `${i.category}||${i.item_name}` === next.product_key)
      let matched = productItems
      if (next.color) matched = matched.filter(i => String(i.color || '') === next.color)
      if (next.size) matched = matched.filter(i => String(i.size || '') === next.size)
      if (matched.length === 1) next.inventory_id = String(matched[0].id)

      return next
    }))
  }

  const addRow = () => setRestockEntries([...restockEntries, { id: Date.now(), product_key: '', color: '', size: '', inventory_id: '', qty: '' }])
  const removeRow = (id: number) => setRestockEntries(restockEntries.filter(e => e.id !== id))

  const filteredInventoryGrouped = useMemo(() => {
    const groups: Record<string, any[]> = {}
    const filtered = inventory.filter(item => {
      const matchesSearch = item.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) || (item.item_id_code||"").toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCat = selectedCats.length === 0 || selectedCats.includes(item.category);
      const matchesStock = showLowStock ? (item.quantity <= item.threshold) : true
      return matchesSearch && matchesCat && matchesStock
    })

    filtered.forEach(item => {
      const cat = item.category || 'Other'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(item)
    })
    Object.keys(groups).forEach(cat => {
      groups[cat] = groups[cat].sort((a, b) => {
        const nameCmp = String(a.item_name || '').localeCompare(String(b.item_name || ''), undefined, { numeric: true })
        if (nameCmp !== 0) return nameCmp
        const colorCmp = String(a.color || '').localeCompare(String(b.color || ''), undefined, { numeric: true })
        if (colorCmp !== 0) return colorCmp
        return compareSize(a.size, b.size)
      })
    })
    return groups;
  }, [inventory, searchTerm, selectedCats, showLowStock])

  const handleExportExcel = () => {
    const rows = Object.entries(filteredInventoryGrouped).flatMap(([category, items]) =>
      items.map((item) => ({
        Category: category,
        Code: item.item_id_code || '',
        'Item Name': item.item_name || '',
        Color: item.color || '',
        Size: item.size || '',
        Unit: item.unit || 'Piece',
        Quantity: Number(item.quantity || 0),
        Threshold: Number(item.threshold || 0),
        Status: Number(item.quantity || 0) <= Number(item.threshold || 0) ? 'Low Stock' : 'OK',
      })),
    )

    if (rows.length === 0) {
      toast.error('No inventory data to export')
      return
    }

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory')
    const stamp = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(workbook, `kmt-inventory-${stamp}.xlsx`)
    toast.success(`Exported ${rows.length} inventory rows`)
  }

  const handleSaveItem = async () => {
    if (!editingItem.item_name || !editingItem.category) return toast.error('Required fields missing')
    await supabase.from('ppe_inventory').upsert({
      id: editingItem.id || undefined, item_name: editingItem.item_name, item_id_code: editingItem.item_id_code,
      category: editingItem.category, color: editingItem.color, size: editingItem.size,
      quantity: Number(editingItem.quantity), threshold: Number(editingItem.threshold), unit: editingItem.unit || 'Piece'
    })
    toast.success('Inventory Saved'); setIsItemModalOpen(false); fetchData();
  }

  const handleRestockSubmit = async () => {
    const validEntries = restockEntries.filter(e => e.inventory_id && e.qty && Number(e.qty) > 0)
    if (validEntries.length === 0 || !doFile) return toast.error('Check items and DO file')
    setIsProcessingRestock(true)
    try {
      const compressedFile = await imageCompression(doFile, { maxSizeMB: 0.3, maxWidthOrHeight: 1024 })
      const fileName = `DO_${Date.now()}_${doFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      await supabase.storage.from('do-files').upload(fileName, compressedFile)
      const { data: { publicUrl } } = supabase.storage.from('do-files').getPublicUrl(fileName)
      const admin = JSON.parse(localStorage.getItem('kmt_user') || '{}')
      for (const entry of validEntries) {
        const item = inventory.find(i => String(i.id) === String(entry.inventory_id))
        if (!item) continue;
        await supabase.from('ppe_inventory').update({ quantity: Number(item.quantity) + Number(entry.qty) }).eq('id', item.id)
        await supabase.from('restock_history').insert({ item_id: item.id, item_name: item.item_name, quantity_added: Number(entry.qty), added_by: admin.full_name || 'Admin', receipt_url: publicUrl })
      }
      toast.success('Restock Complete'); setRestockEntries([{ id: Date.now(), product_key: '', color: '', size: '', inventory_id: '', qty: '' }]); setDoFile(null); setRestockView('history'); fetchData();
    } catch (e: any) { toast.error(e.message) } finally { setIsProcessingRestock(false) }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-black text-orange-500 font-black animate-pulse uppercase text-xs tracking-widest">Accessing Inventory...</div>

  return (
    <div className="p-4 md:p-12 max-w-[1600px] mx-auto pb-32 pt-28 font-sans text-white uppercase font-bold text-[10px]">
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div><h1 className="text-4xl md:text-5xl font-black italic flex items-center gap-4 tracking-tighter text-white"><Package className="text-blue-500" size={40}/> Inventory</h1></div>
        <div className="flex flex-wrap gap-3">
           <button onClick={handleExportExcel} className="px-8 py-4 bg-blue-600/10 border border-blue-500/30 text-blue-400 rounded-[20px] font-black text-xs flex items-center gap-3 transition-all active:scale-95 shadow-lg shadow-blue-500/5"><Download size={18}/> Export Excel</button>
           <button onClick={() => { setRestockView('entry'); setIsRestockModalOpen(true); }} className="px-8 py-4 bg-emerald-600/10 border border-emerald-500/30 text-emerald-500 rounded-[20px] font-black text-xs flex items-center gap-3 transition-all active:scale-95 shadow-lg shadow-emerald-500/5"><Archive size={18}/> Receive Stock</button>
           <button onClick={() => { setEditingItem({ item_name: '', category: 'Other', quantity: 0, threshold: 1, item_id_code: generateNextCode('Other') }); setIsItemModalOpen(true); }} className="px-8 py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-[20px] font-black text-xs flex items-center gap-3 active:scale-95 transition-all shadow-lg shadow-orange-600/20"><Plus size={18}/> Add Item</button>
        </div>
      </div>

      <div className="space-y-6 mb-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 relative"><Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600" size={20}/><input type="text" placeholder="Search item code or name..." className="w-full bg-black/60 border border-white/10 rounded-[24px] py-4 pl-14 pr-6 text-white outline-none focus:border-orange-500 transition-all text-sm font-bold" onChange={(e) => setSearchTerm(e.target.value)} /></div>
          <button onClick={() => setShowLowStock(!showLowStock)} className={`rounded-[24px] font-black text-xs uppercase flex items-center justify-center gap-3 border transition-all ${showLowStock ? 'bg-red-500/20 border-red-500 text-red-500 shadow-inner' : 'bg-black/40 border-white/10 text-zinc-600 hover:text-red-500'}`}><AlertTriangle size={18}/> {showLowStock ? 'Low Stock Only' : 'Filter Low Stock'}</button>
        </div>

        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-2">
          {categoryConfig.map(cat => {
            const Icon = cat.icon; const isActive = selectedCats.includes(cat.name);
            return (
              <button key={cat.name} onClick={() => toggleCat(cat.name)} className={`flex flex-col items-center justify-center gap-2 min-w-[70px] h-[80px] rounded-2xl border transition-all ${isActive ? 'bg-orange-600 border-orange-400 text-white scale-105 shadow-lg shadow-orange-600/30' : 'bg-zinc-900 border-white/5 text-zinc-500 hover:border-white/20'}`}>
                <Icon size={24} /><span className="text-[8px] font-black uppercase tracking-widest">{cat.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-6">
        {Object.entries(filteredInventoryGrouped).map(([category, items]) => {
          const isExpanded = expandedCats.includes(category);
          return (
            <div key={category} className={`border rounded-[40px] overflow-hidden transition-all duration-300 ${isExpanded ? 'border-orange-500/30 bg-black/40 shadow-2xl' : 'border-white/5 bg-zinc-900/30'}`}>
              <button onClick={() => setExpandedCats(isExpanded ? expandedCats.filter(c => c !== category) : [...expandedCats, category])} className="w-full p-8 flex items-center justify-between outline-none group transition-colors"><div className="flex items-center gap-5 text-orange-500 group-hover:scale-105 transition-transform"><Box size={32}/><h2 className="text-lg font-black text-white tracking-widest uppercase">{category} ({items.length})</h2></div>{isExpanded ? <ChevronDown size={28} className="text-orange-500"/> : <ChevronRight size={28} className="text-zinc-800"/>}</button>
              {isExpanded && (
                <div className="overflow-x-auto border-t border-white/5 bg-black/30 p-6">
                  <table className="w-full text-left text-[12px] font-black border-separate border-spacing-y-3">
                    <thead className="text-zinc-600"><tr><th className="p-6 pl-8">Code</th><th className="p-6">Item Name</th><th className="p-6 text-center">Spec</th><th className="p-6 text-right">Stock</th><th className="p-6 text-center pr-8">Action</th></tr></thead>
                    <tbody>
                      {items.map(item => {
                        const isLow = item.quantity <= item.threshold;
                        return (
                          <tr key={item.id} className="bg-white/5 hover:bg-orange-600/10 transition-all rounded-2xl group">
                            <td className={`p-6 pl-8 rounded-l-[24px] border-l-4 ${isLow ? 'border-red-500/50' : 'border-transparent group-hover:border-orange-500'} text-zinc-500 font-black`}>{item.item_id_code}</td>
                            <td className="p-6 text-white font-bold">{item.item_name}</td>
                            <td className="p-6 text-center text-blue-400 font-black">{item.color} {item.size}</td>
                            <td className={`p-6 text-right font-black text-xl ${isLow ? 'text-red-500' : 'text-emerald-500'}`}>{item.quantity}</td>
                            <td className="p-6 text-center pr-8 rounded-r-[24px]"><button onClick={() => { setEditingItem(item); setIsItemModalOpen(true); }} className="p-3 bg-black/50 border border-white/10 rounded-xl text-orange-400 hover:bg-orange-600 hover:text-white hover:border-orange-500 transition-all"><Edit size={16}/></button></td>
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

      {isItemModalOpen && editingItem && (
        <div className="fixed inset-0 z-[2000] bg-black/98 flex items-center justify-center p-6 backdrop-blur-xl">
          <div className="bg-zinc-900 border border-orange-500/30 rounded-[56px] w-full max-w-xl p-12 space-y-8 shadow-2xl overflow-y-auto max-h-[92vh] no-scrollbar">
            <div className="flex justify-between items-center border-b border-white/5 pb-8 text-orange-500"><h2 className="text-3xl font-black italic uppercase tracking-tighter">Edit Item</h2><button onClick={() => setIsItemModalOpen(false)} className="p-4 bg-white/5 rounded-full hover:bg-red-500 transition-all text-white"><X size={24}/></button></div>
            <div className="grid grid-cols-2 gap-6">
              <div className="col-span-2 space-y-2"><label className="text-orange-500 font-black ml-2 uppercase text-[9px]">CATEGORY *</label><select className="w-full bg-black border border-white/10 p-5 rounded-3xl outline-none text-white font-black text-sm focus:border-orange-500" value={editingItem.category} onChange={e => {const newCat = e.target.value; setEditingItem({...editingItem, category: newCat, item_id_code: editingItem.id ? editingItem.item_id_code : generateNextCode(newCat)})}}>{categoryConfig.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}</select></div>
              <div className="col-span-2 space-y-2"><label className="text-zinc-500 font-black ml-2 uppercase text-[9px]">ITEM NAME *</label><input className="w-full bg-black border border-white/10 p-5 rounded-3xl outline-none text-white font-black text-sm focus:border-orange-500" value={editingItem.item_name} onChange={e => setEditingItem({...editingItem, item_name: e.target.value})}/></div>
              <div className="space-y-2"><label className="text-blue-500 font-black ml-2 uppercase text-[9px]">CODE (AUTO)</label><input className="w-full bg-blue-500/10 border border-blue-500/30 p-5 rounded-3xl text-blue-400 font-black italic text-sm" value={editingItem.item_id_code} readOnly /></div>
              <div className="space-y-2"><label className="text-zinc-500 font-black ml-2 uppercase text-[9px]">UNIT</label><input className="w-full bg-black border border-white/10 p-5 rounded-3xl text-white font-black text-sm" value={editingItem.unit} onChange={e => setEditingItem({...editingItem, unit: e.target.value})}/></div>
              <div className="space-y-2"><label className="text-zinc-500 font-black ml-2 uppercase text-[9px]">COLOR</label><input className="w-full bg-black border border-white/10 p-5 rounded-3xl text-white font-black text-sm" value={editingItem.color} onChange={e => setEditingItem({...editingItem, color: e.target.value})}/></div>
              <div className="space-y-2"><label className="text-zinc-500 font-black ml-2 uppercase text-[9px]">SIZE</label><input className="w-full bg-black border border-white/10 p-5 rounded-3xl text-white font-black text-sm" value={editingItem.size} onChange={e => setEditingItem({...editingItem, size: e.target.value})}/></div>
              <div className="space-y-2"><label className="text-emerald-500 font-black ml-2 uppercase text-[9px]">STOCK QUANTITY</label><input type="number" className="w-full bg-black border border-emerald-500/30 p-5 rounded-3xl outline-none text-emerald-400 font-black text-2xl focus:border-emerald-500" value={editingItem.quantity} onChange={e => setEditingItem({...editingItem, quantity: e.target.value})}/></div>
              <div className="space-y-2"><label className="text-red-500 font-black ml-2 uppercase text-[9px]">LOW ALERT AT</label><input type="number" className="w-full bg-black border border-red-500/30 p-5 rounded-3xl outline-none text-red-400 font-black text-2xl focus:border-red-500" value={editingItem.threshold} onChange={e => setEditingItem({...editingItem, threshold: e.target.value})}/></div>
            </div>
            <button onClick={handleSaveItem} className="w-full py-6 bg-orange-600 hover:bg-orange-500 text-white rounded-[32px] font-black uppercase text-sm shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3"><Save size={24}/> Update Master Data</button>
          </div>
        </div>
      )}

      {isRestockModalOpen && (
        <div className="fixed inset-0 z-[2000] bg-black/98 flex items-center justify-center p-4 md:p-6 backdrop-blur-3xl animate-in zoom-in duration-300">
          <div className="bg-zinc-900 border border-emerald-500/30 rounded-[56px] w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center border-b border-white/5 p-10 shrink-0">
               <div><h2 className="text-4xl font-black italic uppercase tracking-tighter text-emerald-500 flex items-center gap-4"><Archive size={36}/> Receive Shipment</h2><div className="flex flex-wrap gap-2 mt-6 bg-black/60 p-1.5 rounded-[20px] w-fit"><button onClick={() => setRestockView('entry')} className={`px-8 py-3 rounded-2xl text-xs font-black uppercase transition-all ${restockView === 'entry' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'text-zinc-600'}`}>New Entry</button><button onClick={() => setRestockView('history')} className={`px-8 py-3 rounded-2xl text-xs font-black uppercase transition-all ${restockView === 'history' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'text-zinc-600'}`}>Restock History</button><button onClick={() => setRestockView('issue-log')} className={`px-8 py-3 rounded-2xl text-xs font-black uppercase transition-all ${restockView === 'issue-log' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-zinc-600'}`}>Issue Log</button></div></div>
               <button onClick={() => { setIsRestockModalOpen(false); router.push('/admin/inventory'); }} className="p-4 bg-white/5 rounded-full hover:bg-red-500 text-white transition-all self-start shadow-xl"><X size={32}/></button>
            </div>
            <div className="overflow-y-auto p-10 flex-1 no-scrollbar pb-20">
              {restockView === 'entry' ? (
                <div className="space-y-12 animate-in fade-in max-w-4xl mx-auto">
                  <div className="space-y-6">
                    {restockEntries.map((entry, index) => (
                      <div key={entry.id} className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center bg-black/50 p-6 rounded-[32px] border border-white/5 group hover:border-emerald-500/30 transition-all">
                        <div className="md:col-span-4">
                          <select value={entry.product_key} onChange={(e) => updateRow(entry.id, 'product_key', e.target.value)} className="w-full bg-transparent text-base text-white font-black outline-none p-2 uppercase">
                            <option value="">-- Select Product --</option>
                            {[...new Map(inventory.map(i => [`${i.category}||${i.item_name}`, i])).values()].map(i => (
                              <option key={`${i.category}||${i.item_name}`} value={`${i.category}||${i.item_name}`} className="bg-zinc-900">{i.category} | {i.item_name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <select value={entry.color} onChange={(e) => updateRow(entry.id, 'color', e.target.value)} className="w-full bg-transparent text-base text-white font-black outline-none p-2 uppercase">
                            <option value="">-- Color --</option>
                            {[...new Set(inventory.filter(i => `${i.category}||${i.item_name}` === entry.product_key).map(i => i.color).filter(Boolean))].map(color => (
                              <option key={color} value={color} className="bg-zinc-900">{color}</option>
                            ))}
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <select value={entry.size} onChange={(e) => updateRow(entry.id, 'size', e.target.value)} className="w-full bg-transparent text-base text-white font-black outline-none p-2 uppercase">
                            <option value="">-- Size --</option>
                            {[...new Set(
                              inventory
                                .filter(i => `${i.category}||${i.item_name}` === entry.product_key)
                                .filter(i => !entry.color || String(i.color || '') === entry.color)
                                .map(i => i.size)
                                .filter(Boolean)
                            )].map(size => (
                              <option key={size} value={size} className="bg-zinc-900">{size}</option>
                            ))}
                          </select>
                        </div>
                        <div className="md:col-span-3"><input type="number" min="1" placeholder="QTY" value={entry.qty} onChange={(e) => updateRow(entry.id, 'qty', e.target.value)} className="w-full bg-zinc-950 border-2 border-emerald-500/20 p-5 rounded-2xl text-center font-black text-emerald-400 outline-none focus:border-emerald-500 text-2xl" /></div>
                        <div className="md:col-span-1 flex justify-center"><button onClick={() => removeRow(entry.id)} className="text-zinc-800 hover:text-red-500 p-4 bg-white/5 rounded-2xl transition-colors"><Trash2 size={24}/></button></div>
                      </div>
                    ))}
                    <button onClick={addRow} className="w-full py-5 border-2 border-dashed border-zinc-800 rounded-3xl text-xs font-black uppercase text-zinc-600 hover:border-emerald-500 transition-all flex items-center justify-center gap-3"><Plus size={20}/> Add More Items</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-end pt-12 border-t border-white/10 pb-10">
                    <div className="space-y-3"><label className="text-[10px] font-black uppercase text-zinc-600 ml-3 tracking-[0.2em] block">Delivery Document</label><label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed ${doFile ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-white/10 hover:border-emerald-500/50'} rounded-[32px] cursor-pointer transition-all`}><Upload size={32} className="text-zinc-700"/><p className="text-xs">{doFile ? doFile.name : "Select Image"}</p><input type="file" className="hidden" accept="image/*" onChange={(e) => setDoFile(e.target.files?.[0] || null)} /></label></div>
                    <button onClick={handleRestockSubmit} disabled={isProcessingRestock} className="w-full h-32 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[40px] font-black uppercase shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-4">{isProcessingRestock ? <Loader2 className="animate-spin" size={32}/> : <Save size={32}/>} Confirm Intake</button>
                  </div>
                </div>
              ) : restockView === 'history' ? (
                <div className="space-y-6 pb-20 max-w-4xl mx-auto">
                  {history.map(h => (
                    <div key={h.id} className="bg-black/40 border border-white/5 p-8 rounded-[40px] flex justify-between items-center group shadow-xl">
                      <div className="flex items-center gap-8"><a href={h.receipt_url} target="_blank" rel="noopener noreferrer" className="p-5 bg-emerald-500/10 text-emerald-500 rounded-[24px] hover:bg-emerald-500 hover:text-white transition-all"><FileText size={32}/></a><div><p className="text-white font-black text-lg uppercase italic">{h.item_name}</p><div className="flex gap-6 mt-2 text-zinc-600 font-bold uppercase text-[10px] tracking-widest"><span>{new Date(h.created_at).toLocaleString()}</span><span>By: {h.added_by}</span></div></div></div>
                      <div className="text-right"><p className="text-emerald-500 font-black text-2xl">+{h.quantity_added}</p></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4 pb-20 max-w-5xl mx-auto animate-in fade-in">
                  <div className="rounded-[32px] border border-blue-500/20 bg-blue-500/10 p-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-blue-300 text-[10px] tracking-[0.25em] uppercase">Stock Movement Audit</p>
                        <p className="mt-2 text-sm normal-case text-zinc-300">Latest {stockTransactions.length} stock deductions from received requests and direct issue.</p>
                        <p className="mt-1 text-[11px] normal-case text-zinc-500">If this is empty after deploy, rerun sql/ppe_stock_transactions.sql once to backfill old received requests.</p>
                      </div>
                      <button onClick={() => fetchStockTransactions(true)} disabled={isRefreshingTransactions} className="rounded-2xl border border-blue-400/30 bg-blue-500/10 px-5 py-3 text-[10px] font-black text-blue-200 transition-all hover:bg-blue-500 hover:text-white disabled:cursor-wait disabled:opacity-60">
                        {isRefreshingTransactions ? 'Refreshing...' : 'Refresh Log'}
                      </button>
                    </div>
                    {stockTransactionError && (
                      <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-[11px] normal-case text-red-200">
                        {stockTransactionError}. Run <span className="font-black text-white">sql/ppe_stock_transactions.sql</span> in Supabase, then press Refresh Log again.
                      </div>
                    )}
                  </div>
                  {stockTransactions.length === 0 ? (
                    <div className="rounded-[40px] border border-white/5 bg-black/40 p-12 text-center text-zinc-600 font-black tracking-widest">
                      No issue transactions yet
                    </div>
                  ) : stockTransactions.map((movement) => (
                    <div key={movement.id} className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-5 rounded-[32px] border border-white/5 bg-black/40 p-6 shadow-xl">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className={`rounded-full px-3 py-1 text-[8px] font-black tracking-widest ${movement.movement_type === 'direct_issue' ? 'bg-orange-500/20 text-orange-300' : 'bg-blue-500/20 text-blue-300'}`}>
                            {String(movement.movement_type || 'issue').replace(/_/g, ' ')}
                          </span>
                          <span className="text-zinc-600 text-[10px]">{new Date(movement.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-white text-base font-black italic uppercase">
                          {movement.item_name || 'Unknown Item'}
                          <span className="ml-2 text-blue-300 text-xs not-italic">{[movement.color, movement.size].filter(Boolean).join(' | ')}</span>
                        </p>
                        <p className="text-zinc-400 normal-case text-xs">
                          Crew: <span className="text-white font-black">{movement.crew_name || '-'}</span>
                          <span className="mx-2 text-zinc-700">|</span>
                          By: <span className="text-white font-black">{movement.actor_name || '-'}</span>
                        </p>
                        {movement.note && <p className="text-[11px] normal-case text-zinc-600">{movement.note}</p>}
                      </div>
                      <div className="flex items-center justify-end">
                        <span className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-3 text-xl font-black text-red-400">
                          {movement.quantity_delta}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function InventoryPage() { return ( <Suspense fallback={<div>Loading...</div>}><InventoryContent /></Suspense> ) }
