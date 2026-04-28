'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  buildInventoryExportRows,
  buildRestockBatchExportRows,
  DO_BUCKET,
  generateInventoryCode,
  getRestockMonthOptions,
  groupInventoryByCategory,
  groupRestockBatches,
} from '@/lib/inventory'
import { EditItemModal } from '@/components/inventory/EditItemModal'
import { InventoryControls } from '@/components/inventory/InventoryControls'
import { InventoryList } from '@/components/inventory/InventoryList'
import { IssueLogPanel } from '@/components/inventory/IssueLogPanel'
import { RestockEntryPanel } from '@/components/inventory/RestockEntryPanel'
import { RestockHistoryPanel } from '@/components/inventory/RestockHistoryPanel'
import {
  X, Archive,
  HardHat, Headphones, Eye, Wind, Shirt, Hand, Footprints, MoreHorizontal
} from 'lucide-react'

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
  const [doNumber, setDoNumber] = useState('')
  const [restockMonthFilter, setRestockMonthFilter] = useState('all')
  const [expandedRestockBatches, setExpandedRestockBatches] = useState<string[]>([])
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

  const generateNextCode = (catName: string) => generateInventoryCode(inventory, catName)

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

  const generateDoNumber = () => {
    const now = new Date()
    const date = now.toISOString().slice(0, 10).replace(/-/g, '')
    const time = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0')
    return `DO-${date}-${time}`
  }

  const isMissingRestockColumn = (error: unknown) => {
    const message = String((error as { message?: string })?.message || '').toLowerCase()
    return message.includes('schema cache') || message.includes('column')
  }

  const insertRestockHistory = async (row: Record<string, any>) => {
    const result = await supabase.from('restock_history').insert(row)
    if (!result.error) return result
    if (!isMissingRestockColumn(result.error)) return result

    const { batch_id: _batchId, do_number: _doNumber, color: _color, size: _size, ...legacyRow } = row
    return supabase.from('restock_history').insert(legacyRow)
  }

  const getAtomicDeleteMessage = (message: string) => {
    const normalized = message.toLowerCase()
    if (normalized.includes('delete_restock_history_lines') || normalized.includes('function') || normalized.includes('schema cache')) {
      return 'Run sql/restock_do_batches.sql in Supabase first, then try deleting again.'
    }
    return message || 'Unable to delete restock history'
  }

  const deleteRestockIds = async (ids: string[]) => {
    const validIds = ids.filter(Boolean)
    if (validIds.length === 0) return { error: { message: 'No restock rows selected' } }

    return supabase.rpc('delete_restock_history_lines', { p_restock_ids: validIds })
  }

  const deleteRestockLine = async (line: any) => {
    if (!confirm(`Delete restock line "${line.item_name}" and subtract ${line.quantity_added} from current stock?`)) return

    const { error } = await deleteRestockIds([line.id])
    if (error) return toast.error(getAtomicDeleteMessage(error.message))

    toast.success('Restock line deleted and stock adjusted')
    fetchData()
  }

  const deleteRestockBatch = async (batch: any) => {
    if (!confirm(`Delete DO ${batch.do_number} and subtract ${batch.totalQty} total units from current stock?`)) return

    const ids = batch.lines.map((line: any) => line.id).filter(Boolean)
    const { error } = await deleteRestockIds(ids)
    if (error) return toast.error(getAtomicDeleteMessage(error.message))

    toast.success(`Deleted ${batch.do_number} and adjusted stock`)
    setExpandedRestockBatches(expandedRestockBatches.filter((id) => id !== batch.id))
    fetchData()
  }

  const openDoDocument = async (receiptUrl: string) => {
    if (!receiptUrl) return toast.error('No DO file attached')

    const getStorageFileRef = (value: string) => {
      const directPath = value.match(/^receipts\/(.+)$/)
      if (directPath) return { bucket: DO_BUCKET, path: directPath[1] }

      const legacyDoFilesPath = value.match(/^do-files\/(.+)$/)
      if (legacyDoFilesPath) return null

      try {
        const url = new URL(value)
        const match = url.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/receipts\/(.+)$/)
        return match?.[1] ? { bucket: DO_BUCKET, path: decodeURIComponent(match[1]) } : null
      } catch {
        return null
      }
    }

    const fileRef = getStorageFileRef(receiptUrl)

    if (fileRef?.path) {
      const { data, error } = await supabase.storage.from(fileRef.bucket).createSignedUrl(fileRef.path, 60)
      if (error) {
        const message = String(error.message || '').toLowerCase()
        if (message.includes('not found')) {
          return toast.error('DO file was not found in storage. This older record may point to a file that was never uploaded.')
        }
        return toast.error(error.message || 'Unable to open DO file')
      }
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
      return
    }

    return toast.error('This DO file link points to an old bucket. Please upload the DO again into receipts.')
  }

  const filteredInventoryGrouped = useMemo(
    () => groupInventoryByCategory({ inventory, searchTerm, selectedCats, showLowStock }),
    [inventory, searchTerm, selectedCats, showLowStock],
  )

  const restockMonthOptions = useMemo(() => getRestockMonthOptions(history), [history])

  const restockBatches = useMemo(
    () => groupRestockBatches(history, restockMonthFilter),
    [history, restockMonthFilter],
  )

  const handleExportExcel = async () => {
    const rows = buildInventoryExportRows(filteredInventoryGrouped)

    if (rows.length === 0) {
      toast.error('No inventory data to export')
      return
    }

    const XLSX = await import('xlsx')
    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory')
    const stamp = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(workbook, `kmt-inventory-${stamp}.xlsx`)
    toast.success(`Exported ${rows.length} inventory rows`)
  }

  const handleExportRestockBatch = async (batch: any) => {
    const rows = buildRestockBatchExportRows(batch)

    if (rows.length === 0) {
      toast.error('No DO lines to export')
      return
    }

    const XLSX = await import('xlsx')
    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'DO Detail')
    const safeDoNumber = String(batch.do_number || 'restock-do').replace(/[^a-zA-Z0-9_-]/g, '_')
    XLSX.writeFile(workbook, `${safeDoNumber}.xlsx`)
    toast.success(`Exported ${batch.do_number || 'DO'} detail`)
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
      const finalDoNumber = doNumber.trim() || generateDoNumber()
      const batchId = `${finalDoNumber}-${Date.now()}`
      const imageCompression = (await import('browser-image-compression')).default
      const compressedFile = await imageCompression(doFile, { maxSizeMB: 0.3, maxWidthOrHeight: 1024 })
      const fileName = `${finalDoNumber}_${Date.now()}_${doFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      const { error: uploadError } = await supabase.storage.from(DO_BUCKET).upload(fileName, compressedFile)
      if (uploadError) throw uploadError
      const storedReceiptPath = `${DO_BUCKET}/${fileName}`
      const admin = JSON.parse(localStorage.getItem('kmt_user') || '{}')
      for (const entry of validEntries) {
        const item = inventory.find(i => String(i.id) === String(entry.inventory_id))
        if (!item) continue;
        await supabase.from('ppe_inventory').update({ quantity: Number(item.quantity) + Number(entry.qty) }).eq('id', item.id)
        const { error } = await insertRestockHistory({
          item_id: item.id,
          item_name: item.item_name,
          color: item.color,
          size: item.size,
          quantity_added: Number(entry.qty),
          added_by: admin.full_name || 'Admin',
          receipt_url: storedReceiptPath,
          do_number: finalDoNumber,
          batch_id: batchId,
        })
        if (error) throw error
      }
      toast.success(`Received ${finalDoNumber}`); setRestockEntries([{ id: Date.now(), product_key: '', color: '', size: '', inventory_id: '', qty: '' }]); setDoNumber(''); setDoFile(null); setRestockView('history'); fetchData();
    } catch (e: any) { toast.error(e.message) } finally { setIsProcessingRestock(false) }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-black text-orange-500 font-black animate-pulse uppercase text-xs tracking-widest">Accessing Inventory...</div>

  return (
    <div className="p-4 md:p-12 max-w-[1600px] mx-auto pb-32 pt-28 font-sans text-white uppercase font-bold text-[10px]">
      <InventoryControls
        categoryConfig={categoryConfig}
        selectedCats={selectedCats}
        showLowStock={showLowStock}
        onAddItem={() => { setEditingItem({ item_name: '', category: 'Other', quantity: 0, threshold: 1, item_id_code: generateNextCode('Other') }); setIsItemModalOpen(true); }}
        onExportExcel={handleExportExcel}
        onOpenReceiveStock={() => { setRestockView('entry'); setIsRestockModalOpen(true); }}
        onSearchTermChange={setSearchTerm}
        onShowLowStockChange={setShowLowStock}
        onToggleCat={toggleCat}
      />

      <InventoryList
        expandedCats={expandedCats}
        groupedInventory={filteredInventoryGrouped}
        onEditItem={(item) => { setEditingItem(item); setIsItemModalOpen(true); }}
        onExpandedCatsChange={setExpandedCats}
      />

      {isItemModalOpen && editingItem && (
        <EditItemModal
          categoryConfig={categoryConfig}
          item={editingItem}
          generateNextCode={generateNextCode}
          onChange={setEditingItem}
          onClose={() => setIsItemModalOpen(false)}
          onSave={handleSaveItem}
        />
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
                <RestockEntryPanel
                  doNumber={doNumber}
                  doFile={doFile}
                  inventory={inventory}
                  isProcessingRestock={isProcessingRestock}
                  restockEntries={restockEntries}
                  onAddRow={addRow}
                  onDoFileChange={setDoFile}
                  onDoNumberChange={setDoNumber}
                  onGenerateDoNumber={() => setDoNumber(generateDoNumber())}
                  onRemoveRow={removeRow}
                  onRestockSubmit={handleRestockSubmit}
                  onUpdateRow={updateRow}
                />
              ) : restockView === 'history' ? (
                <RestockHistoryPanel
                  restockBatches={restockBatches}
                  restockMonthFilter={restockMonthFilter}
                  restockMonthOptions={restockMonthOptions}
                  expandedRestockBatches={expandedRestockBatches}
                  onMonthFilterChange={setRestockMonthFilter}
                  onToggleBatch={(batchId) =>
                    setExpandedRestockBatches(
                      expandedRestockBatches.includes(batchId)
                        ? expandedRestockBatches.filter((id) => id !== batchId)
                        : [...expandedRestockBatches, batchId],
                    )
                  }
                  onOpenDoDocument={openDoDocument}
                  onExportRestockBatch={handleExportRestockBatch}
                  onDeleteRestockBatch={deleteRestockBatch}
                  onDeleteRestockLine={deleteRestockLine}
                />
              ) : (
                <IssueLogPanel
                  stockTransactions={stockTransactions}
                  stockTransactionError={stockTransactionError}
                  isRefreshingTransactions={isRefreshingTransactions}
                  onRefreshTransactions={() => fetchStockTransactions(true)}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function InventoryPage() { return ( <Suspense fallback={<div>Loading...</div>}><InventoryContent /></Suspense> ) }
