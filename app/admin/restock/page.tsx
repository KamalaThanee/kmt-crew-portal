'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { PackagePlus, History, Upload, Loader2, FileText, Plus, Trash2, CheckCircle2 } from 'lucide-react'

export default function RestockPage() {
  const [history, setHistory] = useState<any[]>([])
  const [inventory, setInventory] = useState<any[]>([])
  const [view, setView] = useState<'history' | 'entry'>('history')
  const [loading, setLoading] = useState(false)
  
  const [entries, setEntries] = useState([{ id: Date.now(), inventory_id: '', qty: '' }])
  const [doFile, setDoFile] = useState<File | null>(null)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data: hist } = await supabase.from('restock_history').select('*').order('created_at', { ascending: false })
    if (hist) setHistory(hist)
    const { data: inv } = await supabase.from('ppe_inventory').select('*').order('item_name')
    if (inv) setInventory(inv)
  }

  const addRow = () => setEntries([...entries, { id: Date.now(), inventory_id: '', qty: '' }])
  const removeRow = (id: number) => setEntries(entries.filter(e => e.id !== id))
  const updateRow = (id: number, field: string, value: string) => setEntries(entries.map(e => e.id === id ? { ...e, [field]: value } : e))

  const handleRestock = async () => {
    const validEntries = entries.filter(e => e.inventory_id && e.qty && Number(e.qty) > 0)
    if (validEntries.length === 0) return toast.error('Please add at least one valid item')
    if (!doFile) return toast.error('Delivery Order (DO) document is required')

    setLoading(true)
    try {
      const fileName = `DO_${Date.now()}_${doFile.name}`
      await supabase.storage.from('do-files').upload(fileName, doFile)
      const { data: { publicUrl } } = supabase.storage.from('do-files').getPublicUrl(fileName)
      const admin = JSON.parse(localStorage.getItem('kmt_user') || '{}')

      for (const entry of validEntries) {
        const item = inventory.find(i => i.id === entry.inventory_id)
        if (!item) continue;
        await supabase.from('ppe_inventory').update({ quantity: item.quantity + Number(entry.qty) }).eq('id', item.id)
        await supabase.from('restock_history').insert({
          item_id: item.id, item_name: item.item_name, quantity_added: Number(entry.qty),
          added_by: admin.full_name || 'Admin', receipt_url: publicUrl
        })
      }

      toast.success(`Successfully received ${validEntries.length} items`)
      setEntries([{ id: Date.now(), inventory_id: '', qty: '' }])
      setDoFile(null)
      setView('history')
      fetchData()
    } catch (e) {
      toast.error('Error processing goods receipt')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto pb-32 pt-20 font-sans">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-black uppercase italic text-white flex items-center gap-3"><PackagePlus className="text-blue-500"/> Goods Receipt</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Batch Restock Processing</p>
        </div>
        <div className="flex bg-slate-900 rounded-xl p-1 border border-white/5">
          <button onClick={() => setView('history')} className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${view === 'history' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}>History</button>
          <button onClick={() => setView('entry')} className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${view === 'entry' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}>New Entry</button>
        </div>
      </div>

      {view === 'history' ? (
        <div className="space-y-4 animate-in fade-in">
          {history.length === 0 && <p className="text-center py-20 text-slate-600 font-bold uppercase text-xs tracking-widest">No history found</p>}
          {history.map(h => (
            <div key={h.id} className="bg-slate-900 border border-white/5 p-5 rounded-2xl flex justify-between items-center hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-4">
                <a href={h.receipt_url} target="_blank" className="p-3 bg-blue-500/10 text-blue-500 rounded-xl hover:bg-blue-500 hover:text-white transition-colors" title="View DO Document"><FileText size={20}/></a>
                <div>
                  <p className="text-white font-bold text-sm uppercase">{h.item_name}</p>
                  <div className="flex gap-4 mt-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{new Date(h.created_at).toLocaleString()}</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest">By: {h.added_by}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-emerald-500 font-black text-xl">+{h.quantity_added}</p>
                <p className="text-[9px] text-slate-600 uppercase font-bold tracking-tighter italic">Stock Added</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-900 border border-white/10 rounded-[32px] p-6 shadow-2xl animate-in slide-in-from-bottom-4">
          <div className="space-y-4 mb-6">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 border-b border-white/5 pb-2 flex items-center gap-2"><Plus size={16}/> Line Items</h2>
            <div className="grid grid-cols-12 gap-4 text-[10px] font-black uppercase text-slate-500 tracking-widest px-2">
              <div className="col-span-8">Product Details</div>
              <div className="col-span-3 text-center">Receive Qty</div>
              <div className="col-span-1"></div>
            </div>
            {entries.map((entry, index) => (
              <div key={entry.id} className="grid grid-cols-12 gap-4 items-center bg-black/20 p-2 rounded-xl border border-white/5">
                <div className="col-span-8">
                  <select value={entry.inventory_id} onChange={(e) => updateRow(entry.id, 'inventory_id', e.target.value)} className="w-full bg-transparent text-sm text-white outline-none cursor-pointer p-2">
                    <option value="" className="bg-slate-900">-- Select Product --</option>
                    {inventory.map(i => <option key={i.id} value={i.id} className="bg-slate-900">{i.item_id_code ? `[${i.item_id_code}] ` : ''}{i.item_name} {i.color ? ` - ${i.color}` : ''} {i.size ? ` (Size: ${i.size})` : ''}</option>)}
                  </select>
                </div>
                <div className="col-span-3">
                  <input type="number" min="1" placeholder="0" value={entry.qty} onChange={(e) => updateRow(entry.id, 'qty', e.target.value)} className="w-full bg-slate-950 border border-white/10 p-2 rounded-lg text-center font-black text-blue-500 outline-none focus:border-blue-500" />
                </div>
                <div className="col-span-1 flex justify-center">
                  <button onClick={() => removeRow(entry.id)} className="text-red-500/50 hover:text-red-500 transition-colors p-2"><Trash2 size={16}/></button>
                </div>
              </div>
            ))}
            <button onClick={addRow} className="w-full py-3 border border-dashed border-white/20 rounded-xl text-xs font-bold uppercase text-slate-400 hover:border-blue-500 hover:text-blue-500 transition-colors flex items-center justify-center gap-2"><Plus size={14}/> Add Another Item</button>
          </div>
          <div className="pt-6 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block tracking-widest">Supporting Document (DO/Invoice)</label>
              <label className={`flex items-center justify-center w-full h-16 border-2 border-dashed ${doFile ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10 hover:border-blue-500/50'} rounded-2xl cursor-pointer transition-colors`}>
                {doFile ? <div className="text-emerald-500 font-bold text-xs uppercase flex items-center gap-2"><CheckCircle2 size={16}/> {doFile.name}</div> : <div className="text-blue-500 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2"><Upload size={16}/> Select DO File</div>}
                <input type="file" className="hidden" accept="image/*,.pdf" onChange={(e) => setDoFile(e.target.files?.[0] || null)} />
              </label>
            </div>
            <button onClick={handleRestock} disabled={loading} className="w-full h-16 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl shadow-blue-600/20 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 text-white">
              {loading ? <Loader2 className="animate-spin"/> : 'Save Goods Receipt'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
