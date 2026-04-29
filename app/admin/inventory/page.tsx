'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { inventoryCategoryConfig } from '@/lib/inventoryCategories'
import {
  buildInventoryExportRows,
  buildRestockBatchExportRows,
  DO_BUCKET,
  generateDoNumber,
  generateInventoryCode,
  getAtomicDeleteMessage,
  getDoOpenErrorMessage,
  getDoStorageFileRef,
  getRestockMonthOptions,
  groupInventoryByCategory,
  groupRestockBatches,
  isMissingRestockColumn,
  updateRestockEntryRows,
} from '@/lib/inventory'
import { exportJsonRowsToExcel } from '@/lib/excelExport'
import { EditItemModal } from '@/components/inventory/EditItemModal'
import { InventoryControls } from '@/components/inventory/InventoryControls'
import { InventoryList } from '@/components/inventory/InventoryList'
import { ReceiveShipmentModal } from '@/components/inventory/ReceiveShipmentModal'
import { ReceiveShipmentContent } from '@/components/inventory/ReceiveShipmentContent'

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

  const categoryConfig = inventoryCategoryConfig

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
    setRestockEntries(prev => updateRestockEntryRows({ entries: prev, inventory, id, field, value }))
  }

  const addRow = () => setRestockEntries([...restockEntries, { id: Date.now(), product_key: '', color: '', size: '', inventory_id: '', qty: '' }])
  const removeRow = (id: number) => setRestockEntries(restockEntries.filter(e => e.id !== id))

  const insertRestockHistory = async (row: Record<string, any>) => {
    const result = await supabase.from('restock_history').insert(row)
    if (!result.error) return result
    if (!isMissingRestockColumn(result.error)) return result

    const { batch_id: _batchId, do_number: _doNumber, color: _color, size: _size, ...legacyRow } = row
    return supabase.from('restock_history').insert(legacyRow)
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

    const fileRef = getDoStorageFileRef(receiptUrl)

    if (fileRef?.path) {
      const { data, error } = await supabase.storage.from(fileRef.bucket).createSignedUrl(fileRef.path, 60)
      if (error) {
        return toast.error(getDoOpenErrorMessage(error.message))
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

    const stamp = new Date().toISOString().slice(0, 10)
    await exportJsonRowsToExcel({ fileName: `kmt-inventory-${stamp}.xlsx`, rows, sheetName: 'Inventory' })
    toast.success(`Exported ${rows.length} inventory rows`)
  }

  const handleExportRestockBatch = async (batch: any) => {
    const rows = buildRestockBatchExportRows(batch)

    if (rows.length === 0) {
      toast.error('No DO lines to export')
      return
    }

    const safeDoNumber = String(batch.do_number || 'restock-do').replace(/[^a-zA-Z0-9_-]/g, '_')
    await exportJsonRowsToExcel({ fileName: `${safeDoNumber}.xlsx`, rows, sheetName: 'DO Detail' })
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
        <ReceiveShipmentModal
          restockView={restockView}
          onClose={() => { setIsRestockModalOpen(false); router.push('/admin/inventory'); }}
          onViewChange={setRestockView}
        >
          <ReceiveShipmentContent
            doFile={doFile}
            doNumber={doNumber}
            expandedRestockBatches={expandedRestockBatches}
            inventory={inventory}
            isProcessingRestock={isProcessingRestock}
            isRefreshingTransactions={isRefreshingTransactions}
            restockBatches={restockBatches}
            restockEntries={restockEntries}
            restockMonthFilter={restockMonthFilter}
            restockMonthOptions={restockMonthOptions}
            restockView={restockView}
            stockTransactionError={stockTransactionError}
            stockTransactions={stockTransactions}
            onAddRow={addRow}
            onDeleteRestockBatch={deleteRestockBatch}
            onDeleteRestockLine={deleteRestockLine}
            onDoFileChange={setDoFile}
            onDoNumberChange={setDoNumber}
            onExportRestockBatch={handleExportRestockBatch}
            onMonthFilterChange={setRestockMonthFilter}
            onOpenDoDocument={openDoDocument}
            onRefreshTransactions={() => fetchStockTransactions(true)}
            onRemoveRow={removeRow}
            onRestockSubmit={handleRestockSubmit}
            onToggleBatch={(batchId) =>
              setExpandedRestockBatches(
                expandedRestockBatches.includes(batchId)
                  ? expandedRestockBatches.filter((id) => id !== batchId)
                  : [...expandedRestockBatches, batchId],
              )
            }
            onUpdateRow={updateRow}
          />
        </ReceiveShipmentModal>
      )}
    </div>
  )
}

export default function InventoryPage() { return ( <Suspense fallback={<div>Loading...</div>}><InventoryContent /></Suspense> ) }
