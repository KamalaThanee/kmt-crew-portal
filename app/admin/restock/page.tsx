'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { PackagePlus, History, Upload, Loader2, FileText, Plus, X } from 'lucide-react'

export default function RestockPage() {
  const [history, setHistory] = useState<any[]>([])
  const [inventory, setInventory] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedItems, setSelectedItems] = useState<any[]>([])
  const [doFile, setDoFile] = useState<File | null>(null)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data: hist } = await supabase.from('restock_history').select('*').order('created_at', { ascending: false })
    if (hist) setHistory(hist)
    const { data: inv } = await supabase.from('ppe_inventory').select('*').order('item_name')
    if (inv) setInventory(inv)
  }

  const handleRestock = async () => {
    if (!doFile || selectedItems.length === 0) return toast.error('Please upload DO and select items')
    setLoading(true)
    try {
      // 1. Upload DO to Storage
      const fileName = `DO_${Date.now()}.jpg`
      await supabase.storage.from('do-files').upload(fileName, doFile)
      const { data: { publicUrl } } = supabase.storage.from('do-files').getPublicUrl(fileName)

      const admin = JSON.parse(localStorage.getItem('kmt_user') || '{}')

      // 2. Loop Through Selected Items to Update Inventory & Insert History (Row by Row)
      for (const item of selectedItems) {
        // Update Inventory
        await supabase.from('ppe_inventory').update({ quantity: item.quantity + Number(item.addQty) }).eq('id', item.id)

        // Insert History Row (ตาม Schema ของคุณ)
        await supabase.from('restock_history').insert({
          item_id: item.id,
          item_name: item.item_name,
          quantity_added: Number(item.addQty),
          added_by: admin.full_name,
          receipt_url: publicUrl
        })
      }

      toast.success('Inventory Updated Successfully')
      setShowForm(false)
      setSelectedItems([])
      setDoFile(null)
      fetchData()
    } catch (e) {
      toast.error('Error during restocking')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto pb-32 pt-20 text-white font-sans">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-black uppercase italic italic flex items-center gap-3"><PackagePlus className="text-blue-500"/> Restock Control</h1>
        <button onClick={() => setShowForm(true)} className="px-6 py-3 bg-blue-600 rounded-2xl font-black uppercase text-xs flex items-center gap-2 active:scale-95 transition-all shadow-lg shadow-blue-600/20"><Plus size={18}/> Receive Shipment</button>
      </div>

      <div className="space-y-4">
        {history.map(h => (
          <div key={h.id} className="bg-slate-900 border border-white/5 p-5 rounded-[28px] flex justify-between items-center transition-all hover:border-blue-500/30">
            <div className="flex items-center gap-4">
              <a href={h.receipt_url} target="_blank" className="p-3 bg-blue-500/10 text-blue-500 rounded-2xl hover:bg-blue-500 hover:text-white transition-colors"><FileText size={20}/></a>
              <div>
                <p className="text-white font-bold text-sm uppercase">{h.item_name}</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{new Date(h.created_at).toLocaleString()}</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Added By: {h.added_by}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-emerald-500 font-black text-xl">+{h.quantity_added}</p>
              <p className="text-[9px] text-slate-600 uppercase font-bold tracking-tighter italic">Stock Updated</p>
            </div>
          </div>
        ))}
      </div>

      {/* Form Modal (เหมือนเดิมแต่ปรับ Logic ให้ตรง Schema) */}
      {showForm && (
        <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col p-6 animate-in slide-in-from-bottom duration-300">
           {/* ... UI Form สำหรับเลือกสินค้าเหมือนโค้ดก่อนหน้า ... */}
           <div className="flex justify-between items-center mb-8">
             <h2 className="text-2xl font-black uppercase italic italic">Receive New Shipment</h2>
             <button onClick={() => setShowForm(false)} className="p-3 bg-white/5 rounded-full"><X/></button>
           </div>
           
           <div className="space-y-6 max-w-md mx-auto w-full">
              <select onChange={(e) => {
                const item = inventory.find(i => i.id === e.target.value)
                if (item && !selectedItems.find(si => si.id === item.id)) setSelectedItems([...selectedItems, {...item, addQty: 0}])
              }} className="w-full bg-slate-900 border border-white/10 p-4 rounded-2xl text-xs text-white">
                <option value="">-- Select Product --</option>
                {inventory.map(i => <option key={i.id} value={i.id}>{i.item_name} ({i.color} {i.size})</option>)}
              </select>

              <div className="space-y-3">
                {selectedItems.map((si, idx) => (
                  <div key={idx} className="bg-white/5 p-4 rounded-2xl flex justify-between items-center">
                    <div><p className="text-xs font-bold text-white uppercase">{si.item_name}</p><p className="text-[10px] text-slate-500">{si.color} | {si.size}</p></div>
                    <input type="number" placeholder="Qty" className="w-20 bg-black border border-white/10 p-2 rounded-xl text-center font-bold text-blue-500" onChange={(e) => {
                      const newItems = [...selectedItems]; newItems[idx].addQty = e.target.value; setSelectedItems(newItems);
                    }} />
                  </div>
                ))}
              </div>

              <input type="file" className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white" onChange={(e) => setDoFile(e.target.files?.[0] || null)} />

              <button onClick={handleRestock} disabled={loading} className="w-full py-5 bg-blue-600 rounded-3xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-600/20 active:scale-95 transition-all">
                {loading ? <Loader2 className="animate-spin inline mr-2"/> : 'Confirm Stock Intake'}
              </button>
           </div>
        </div>
      )}
    </div>
  )
}
