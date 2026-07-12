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

type PpeSizeWindow = {
  id?: string
  title?: string | null
  status?: string | null
  deadline_at?: string | null
  opened_by?: string | null
  opened_at?: string | null
  closed_by?: string | null
  closed_at?: string | null
}

type PpeSizeResponse = {
  id?: string
  window_id?: string | null
  crew_id?: string | null
  crew_name?: string | null
  position?: string | null
  suit_color?: string | null
  suit_size?: string | null
  boot_size?: string | null
  confirmed_at?: string | null
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

const sizeSort = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })

const colorSort = (a: string, b: string) => {
  const order = ['white', 'orange']
  const aIndex = order.indexOf(a.toLowerCase())
  const bIndex = order.indexOf(b.toLowerCase())
  if (aIndex !== -1 || bIndex !== -1) return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex)
  return a.localeCompare(b)
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
  const [isSizeSummaryOpen, setIsSizeSummaryOpen] = useState(false)
  const [restockView, setRestockView] = useState<'entry' | 'history' | 'issue-log'>('entry')
  const [crewSizeRows, setCrewSizeRows] = useState<any[]>([])
  const [ppeSizeResponses, setPpeSizeResponses] = useState<PpeSizeResponse[]>([])
  const [activeSizeWindow, setActiveSizeWindow] = useState<PpeSizeWindow | null>(null)
  const [sizeCharts, setSizeCharts] = useState({ suit: '', boot: '' })
  const [uploadingSizeChart, setUploadingSizeChart] = useState({ suit: false, boot: false })
  const [sizeWindowTitle, setSizeWindowTitle] = useState(`PPE Size Update ${new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`)
  const [sizeWindowDeadline, setSizeWindowDeadline] = useState('')
  const [isProcessingSizeWindow, setIsProcessingSizeWindow] = useState(false)

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
        if ((movements || []).length > 0) toast.success(`Loaded ${movements?.length || 0} stock movements`)
        else toast.info('No stock movements yet. Run the SQL backfill if old received requests should appear.')
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

  const fetchPpeSizeSummary = async () => {
    const [crewRes, windowRes, settingsRes] = await Promise.all([
      supabase
        .from('crews')
        .select('id, full_name, position, registered, is_active, resigned_at, suit_color, suit_size, boot_size, ppe_size_confirmed_at, ppe_size_confirmed_window_id')
        .order('full_name'),
      supabase
        .from('ppe_size_windows')
        .select('*')
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('ppe_settings').select('suit_chart_url, boot_url').eq('id', 1).maybeSingle(),
    ])

    if (crewRes.error) {
      toast.error(crewRes.error.message || 'Unable to load crew size data')
    } else {
      setCrewSizeRows(
        (crewRes.data || []).filter((crew: any) => {
          const hasPpeSize = !!crew?.suit_color || !!crew?.suit_size || !!crew?.boot_size
          return (crew?.registered === true || hasPpeSize) && crew?.is_active !== false && !crew?.resigned_at
        }),
      )
    }

    if (windowRes.error) {
      setActiveSizeWindow(null)
      setPpeSizeResponses([])
      if (!String(windowRes.error.message || '').includes('ppe_size_windows')) {
        toast.error(windowRes.error.message)
      }
    } else {
      const activeWindow = (windowRes.data || null) as PpeSizeWindow | null
      setActiveSizeWindow(activeWindow)

      if (activeWindow?.id) {
        const { data: responses, error: responsesError } = await supabase
          .from('ppe_size_responses')
          .select('id, window_id, crew_id, crew_name, position, suit_color, suit_size, boot_size, confirmed_at')
          .eq('window_id', activeWindow.id)
          .order('confirmed_at', { ascending: false })

        if (responsesError) setPpeSizeResponses([])
        else setPpeSizeResponses((responses || []) as PpeSizeResponse[])
      } else {
        setPpeSizeResponses([])
      }
    }

    if (!settingsRes.error && settingsRes.data) {
      setSizeCharts({
        suit: settingsRes.data.suit_chart_url || '',
        boot: settingsRes.data.boot_url || '',
      })
    }
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

  const ppeSizeSummary = useMemo(() => {
    const suit = new Map<string, number>()
    const boots = new Map<string, number>()
    const profileSuit = new Map<string, number>()
    const profileBoots = new Map<string, number>()
    const fallbackConfirmedRows = activeSizeWindow?.id
      ? crewSizeRows
        .filter((crew: any) => String(crew.ppe_size_confirmed_window_id || '') === String(activeSizeWindow.id))
        .map((crew: any) => ({
          crew_id: crew.id,
          crew_name: crew.full_name,
          position: crew.position,
          suit_color: crew.suit_color,
          suit_size: crew.suit_size,
          boot_size: crew.boot_size,
          confirmed_at: crew.ppe_size_confirmed_at,
        }))
      : []
    const confirmedRows = ppeSizeResponses.length > 0 ? ppeSizeResponses : fallbackConfirmedRows
    const confirmedCrewIds = new Set(confirmedRows.map((row) => String(row.crew_id || '')).filter(Boolean))
    const pendingRows = crewSizeRows.filter((crew) => !confirmedCrewIds.has(String(crew.id || '')))
    const missingSizeRows = crewSizeRows.filter((crew) => !crew.suit_color || !crew.suit_size || !crew.boot_size)

    crewSizeRows.forEach((crew) => {
      const suitKey = [crew.suit_color || 'No Color', crew.suit_size || 'No Size'].join(' | ')
      const bootKey = crew.boot_size || 'No Size'
      if (crew.suit_color && crew.suit_size) profileSuit.set(suitKey, (profileSuit.get(suitKey) || 0) + 1)
      if (crew.boot_size) profileBoots.set(bootKey, (profileBoots.get(bootKey) || 0) + 1)
    })

    confirmedRows.forEach((response) => {
      const suitKey = [response.suit_color || 'No Color', response.suit_size || 'No Size'].join(' | ')
      const bootKey = response.boot_size || 'No Size'
      if (response.suit_color && response.suit_size) suit.set(suitKey, (suit.get(suitKey) || 0) + 1)
      if (response.boot_size) boots.set(bootKey, (boots.get(bootKey) || 0) + 1)
    })

    return {
      confirmed: confirmedRows.length,
      pendingRows,
      missing: missingSizeRows,
      suitRows: Array.from(suit.entries()).map(([key, qty]) => {
        const [color, size] = key.split(' | ')
        return { Color: color, Size: size, 'Required Qty': qty }
      }).sort((a, b) => colorSort(a.Color, b.Color) || sizeSort(a.Size, b.Size)),
      bootRows: Array.from(boots.entries())
        .map(([size, qty]) => ({ Size: size, 'Required Qty': qty }))
        .sort((a, b) => sizeSort(a.Size, b.Size)),
      profileSuitRows: Array.from(profileSuit.entries()).map(([key, qty]) => {
        const [color, size] = key.split(' | ')
        return { Color: color, Size: size, Qty: qty }
      }).sort((a, b) => colorSort(a.Color, b.Color) || sizeSort(a.Size, b.Size)),
      profileBootRows: Array.from(profileBoots.entries())
        .map(([size, qty]) => ({ Size: size, Qty: qty }))
        .sort((a, b) => sizeSort(a.Size, b.Size)),
    }
  }, [activeSizeWindow?.id, crewSizeRows, ppeSizeResponses])

  const openPpeSizeSummary = async () => {
    setIsSizeSummaryOpen(true)
    await fetchPpeSizeSummary()
  }

  const handleOpenSizeWindow = async () => {
    if (!sizeWindowTitle.trim()) return toast.error('Enter update window title')
    setIsProcessingSizeWindow(true)
    const admin = JSON.parse(localStorage.getItem('kmt_user') || '{}')

    await supabase
      .from('ppe_size_windows')
      .update({
        status: 'closed',
        closed_by: admin.full_name || admin.position || 'Admin',
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('status', 'open')

    const { data, error } = await supabase.from('ppe_size_windows').insert({
      title: sizeWindowTitle.trim(),
      status: 'open',
      deadline_at: sizeWindowDeadline ? new Date(sizeWindowDeadline).toISOString() : null,
      opened_by: admin.full_name || admin.position || 'Admin',
    }).select('*').single()
    setIsProcessingSizeWindow(false)
    if (error) return toast.error(`${error.message}. Run sql/ppe_size_update_window.sql first.`)
    setActiveSizeWindow((data || null) as PpeSizeWindow | null)
    toast.success('PPE size update window opened')
    window.dispatchEvent(new Event('new-notification'))
    await fetchPpeSizeSummary()
  }

  const handleCloseSizeWindow = async () => {
    if (!activeSizeWindow?.id) return
    if (!confirm(`Close ${activeSizeWindow.title || 'current PPE size update window'}?`)) return
    setIsProcessingSizeWindow(true)
    const admin = JSON.parse(localStorage.getItem('kmt_user') || '{}')
    const { error } = await supabase.from('ppe_size_windows').update({
      status: 'closed',
      closed_by: admin.full_name || admin.position || 'Admin',
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', activeSizeWindow.id)
    setIsProcessingSizeWindow(false)
    if (error) return toast.error(error.message)
    toast.success('PPE size update window closed')
    window.dispatchEvent(new Event('new-notification'))
    await fetchPpeSizeSummary()
  }

  const handleExportPpeSizeSummary = async () => {
    if (crewSizeRows.length === 0) return toast.error('No crew size data to export')
    const detailRows = crewSizeRows.map((crew) => {
      const response = ppeSizeResponses.find((row) => String(row.crew_id || '') === String(crew.id || ''))
      const fallbackConfirmed = activeSizeWindow?.id && String(crew.ppe_size_confirmed_window_id || '') === String(activeSizeWindow.id)

      return {
        Crew: crew.full_name || '',
        Position: crew.position || '',
        'Suit Color': response?.suit_color || crew.suit_color || '',
        'Suit Size': response?.suit_size || crew.suit_size || '',
        'Boot Size': response?.boot_size || crew.boot_size || '',
        'Confirmed At': formatDateTime(response?.confirmed_at || (fallbackConfirmed ? crew.ppe_size_confirmed_at : null)),
        Status: activeSizeWindow?.id && (response || fallbackConfirmed) ? 'Confirmed' : 'Waiting',
      }
    })
    const rows = [
      { Section: 'Boiler Suit Required Summary', Color: '', Size: '', 'Required Qty': '' },
      ...ppeSizeSummary.suitRows.map((row) => ({ Section: 'Boiler Suit', ...row })),
      { Section: '', Color: '', Size: '', 'Required Qty': '' },
      { Section: 'Safety Boots Required Summary', Color: '', Size: '', 'Required Qty': '' },
      ...ppeSizeSummary.bootRows.map((row) => ({ Section: 'Safety Boots', Color: '', ...row })),
      { Section: '', Color: '', Size: '', 'Required Qty': '' },
      ...detailRows.map((row) => ({ Section: 'Crew Detail', ...row })),
    ]
    const stamp = new Date().toISOString().slice(0, 10)
    await exportJsonRowsToExcel({ fileName: `kmt-ppe-size-summary-${stamp}.xlsx`, rows, sheetName: 'PPE Size Summary' })
    toast.success('Exported PPE size summary')
  }

  const handleUploadSizeChart = async (type: 'suit' | 'boot', file: File) => {
    setUploadingSizeChart((prev) => ({ ...prev, [type]: true }))
    try {
      const imageCompression = (await import('browser-image-compression')).default
      const compressedFile = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1280 })
      const fileName = `${type}_chart_${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage.from('size-charts').upload(fileName, compressedFile)
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('size-charts').getPublicUrl(fileName)
      const column = type === 'suit' ? 'suit_chart_url' : 'boot_url'
      const { error: updateError } = await supabase.from('ppe_settings').update({ [column]: publicUrl }).eq('id', 1)
      if (updateError) throw updateError

      setSizeCharts((prev) => ({ ...prev, [type]: publicUrl }))
      toast.success(`${type === 'suit' ? 'Boiler suit' : 'Safety boots'} size chart updated`)
    } catch (error: any) {
      toast.error(error?.message || 'Unable to upload size chart')
    } finally {
      setUploadingSizeChart((prev) => ({ ...prev, [type]: false }))
    }
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
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto pb-32 pt-10 md:pt-28 font-sans text-white uppercase font-bold text-[10px]">
      <InventoryControls
        categoryConfig={categoryConfig}
        selectedCats={selectedCats}
        showLowStock={showLowStock}
        onAddItem={() => { setEditingItem({ item_name: '', category: 'Other', quantity: 0, threshold: 1, item_id_code: generateNextCode('Other') }); setIsItemModalOpen(true); }}
        onExportExcel={handleExportExcel}
        onOpenPpeSizeSummary={openPpeSizeSummary}
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

      {isSizeSummaryOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/95 p-4 backdrop-blur-2xl">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[48px] border border-amber-500/25 bg-zinc-950 shadow-2xl">
            <div className="flex flex-col gap-4 border-b border-white/10 p-7 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-300">PPE Size Update Window</p>
                <h2 className="mt-2 text-3xl font-black italic text-white">Boiler Suit & Safety Boots Summary</h2>
                <p className="mt-1 text-xs normal-case text-zinc-500">Open a window for crew to confirm sizes, then export the summary for ordering.</p>
              </div>
              <button onClick={() => setIsSizeSummaryOpen(false)} className="rounded-2xl bg-white/5 px-4 py-3 text-xs font-black uppercase text-zinc-300 hover:bg-white/10">Close</button>
            </div>
            <div className="max-h-[72vh] space-y-5 overflow-y-auto p-7">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-[28px] border border-white/10 bg-black/40 p-5">
                  <p className="text-[9px] tracking-[0.25em] text-zinc-500">REGISTERED CREW</p>
                  <p className="mt-2 text-3xl font-black text-white">{crewSizeRows.length}</p>
                </div>
                <div className="rounded-[28px] border border-emerald-500/20 bg-emerald-500/10 p-5">
                  <p className="text-[9px] tracking-[0.25em] text-emerald-200">CONFIRMED</p>
                  <p className="mt-2 text-3xl font-black text-white">{ppeSizeSummary.confirmed}</p>
                </div>
                <div className="rounded-[28px] border border-red-500/20 bg-red-500/10 p-5">
                  <p className="text-[9px] tracking-[0.25em] text-red-200">WAITING</p>
                  <p className="mt-2 text-3xl font-black text-white">{ppeSizeSummary.pendingRows.length}</p>
                </div>
                <div className="rounded-[28px] border border-amber-500/20 bg-amber-500/10 p-5">
                  <p className="text-[9px] tracking-[0.25em] text-amber-200">WINDOW</p>
                  <p className="mt-2 text-sm font-black text-white">{activeSizeWindow ? 'OPEN' : 'CLOSED'}</p>
                </div>
              </div>

              <div className="rounded-[30px] border border-white/10 bg-black/35 p-5">
                {activeSizeWindow ? (
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-black text-white">{activeSizeWindow.title}</p>
                      <p className="mt-1 text-xs normal-case text-zinc-500">Deadline: {formatDateTime(activeSizeWindow.deadline_at)} | Opened by {activeSizeWindow.opened_by || '-'}</p>
                    </div>
                    <button onClick={handleCloseSizeWindow} disabled={isProcessingSizeWindow} className="rounded-2xl bg-red-600 px-5 py-3 text-xs font-black uppercase text-white disabled:opacity-50">Close Window</button>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
                    <input value={sizeWindowTitle} onChange={(event) => setSizeWindowTitle(event.target.value)} className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm font-bold text-white outline-none focus:border-amber-500" />
                    <input type="datetime-local" value={sizeWindowDeadline} onChange={(event) => setSizeWindowDeadline(event.target.value)} className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm font-bold text-white outline-none focus:border-amber-500" />
                    <button onClick={handleOpenSizeWindow} disabled={isProcessingSizeWindow} className="rounded-2xl bg-amber-600 px-5 py-3 text-xs font-black uppercase text-white disabled:opacity-50">Open Window</button>
                  </div>
                )}
              </div>

              <div className="rounded-[30px] border border-orange-500/20 bg-orange-500/[0.04] p-5">
                <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-300">Size Chart</p>
                    <p className="mt-1 text-[10px] normal-case text-zinc-500">Upload the chart crew will see when confirming PPE sizes.</p>
                  </div>
                  <p className="text-[9px] normal-case text-zinc-600">Stored in PPE settings and reused in registration.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {(['suit', 'boot'] as const).map((type) => (
                    <div key={type} className="rounded-[26px] border border-white/10 bg-black/40 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white">{type === 'suit' ? 'Boiler Suit Chart' : 'Safety Boots Chart'}</p>
                        <label className="cursor-pointer rounded-2xl bg-orange-600 px-4 py-2 text-[9px] font-black uppercase text-white hover:bg-orange-500">
                          {uploadingSizeChart[type] ? 'Uploading...' : 'Update'}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploadingSizeChart[type]}
                            onChange={(event) => event.target.files?.[0] && handleUploadSizeChart(type, event.target.files[0])}
                          />
                        </label>
                      </div>
                      <div className="flex h-56 items-center justify-center overflow-hidden rounded-2xl border border-white/5 bg-zinc-950">
                        {sizeCharts[type] ? (
                          <img src={sizeCharts[type]} alt={`${type} size chart`} className="max-h-full max-w-full object-contain" />
                        ) : (
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-700">No chart uploaded</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button onClick={handleExportPpeSizeSummary} className="rounded-2xl border border-blue-500/30 bg-blue-500/10 px-5 py-3 text-xs font-black uppercase text-blue-200 hover:bg-blue-500 hover:text-white">Export Summary</button>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="rounded-[30px] border border-white/10 bg-black/35 p-5">
                  <p className="mb-4 text-[10px] font-black uppercase tracking-[0.3em] text-amber-200">Boiler Suit</p>
                  <p className="mb-4 text-[10px] normal-case text-zinc-500">Required quantity by color and size from confirmed crew only.</p>
                  <div className="space-y-2">
                    {ppeSizeSummary.suitRows.length > 0 ? ppeSizeSummary.suitRows.map((row) => (
                      <div key={`${row.Color}-${row.Size}`} className="grid grid-cols-[1fr_90px] items-center gap-3 rounded-xl bg-white/5 px-4 py-3 text-xs">
                        <span><b className="text-white">{row.Color}</b> | {row.Size}</span>
                        <span className="text-right"><b className="text-lg text-amber-200">{row['Required Qty']}</b> <span className="text-[9px] text-zinc-500">pcs</span></span>
                      </div>
                    )) : <p className="rounded-xl bg-white/5 px-4 py-3 text-xs text-zinc-500">No confirmed boiler suit sizes yet</p>}
                    {ppeSizeSummary.suitRows.length === 0 && ppeSizeSummary.profileSuitRows.length > 0 && (
                      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <p className="mb-3 text-[9px] font-black uppercase tracking-[0.25em] text-zinc-500">Current profile snapshot, not order qty</p>
                        <div className="space-y-2">
                          {ppeSizeSummary.profileSuitRows.map((row) => (
                            <div key={`profile-${row.Color}-${row.Size}`} className="grid grid-cols-[1fr_70px] rounded-xl bg-black/30 px-3 py-2 text-[11px] text-zinc-400">
                              <span><b className="text-zinc-200">{row.Color}</b> | {row.Size}</span>
                              <span className="text-right">{row.Qty}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="rounded-[30px] border border-white/10 bg-black/35 p-5">
                  <p className="mb-4 text-[10px] font-black uppercase tracking-[0.3em] text-amber-200">Safety Boots</p>
                  <p className="mb-4 text-[10px] normal-case text-zinc-500">Required quantity by boots size from confirmed crew only.</p>
                  <div className="space-y-2">
                    {ppeSizeSummary.bootRows.length > 0 ? ppeSizeSummary.bootRows.map((row) => (
                      <div key={row.Size} className="grid grid-cols-[1fr_90px] items-center gap-3 rounded-xl bg-white/5 px-4 py-3 text-xs">
                        <span>{row.Size}</span>
                        <span className="text-right"><b className="text-lg text-amber-200">{row['Required Qty']}</b> <span className="text-[9px] text-zinc-500">pairs</span></span>
                      </div>
                    )) : <p className="rounded-xl bg-white/5 px-4 py-3 text-xs text-zinc-500">No confirmed safety boots sizes yet</p>}
                    {ppeSizeSummary.bootRows.length === 0 && ppeSizeSummary.profileBootRows.length > 0 && (
                      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <p className="mb-3 text-[9px] font-black uppercase tracking-[0.25em] text-zinc-500">Current profile snapshot, not order qty</p>
                        <div className="space-y-2">
                          {ppeSizeSummary.profileBootRows.map((row) => (
                            <div key={`profile-${row.Size}`} className="grid grid-cols-[1fr_70px] rounded-xl bg-black/30 px-3 py-2 text-[11px] text-zinc-400">
                              <span>{row.Size}</span>
                              <span className="text-right">{row.Qty}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-[30px] border border-white/10 bg-black/35 p-5">
                <p className="mb-4 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Crew Detail</p>
                <div className="space-y-2">
                  {crewSizeRows.map((crew) => {
                    const response = ppeSizeResponses.find((row) => String(row.crew_id || '') === String(crew.id || ''))
                    const fallbackConfirmed = activeSizeWindow?.id && String(crew.ppe_size_confirmed_window_id || '') === String(activeSizeWindow.id)

                    return (
                      <div key={crew.id} className="grid gap-2 rounded-xl bg-white/5 px-4 py-3 text-xs normal-case md:grid-cols-[1fr_120px_120px_120px_180px]">
                        <b className="text-white">{crew.full_name}</b>
                        <span>{response?.suit_color || crew.suit_color || '-'}</span>
                        <span>{response?.suit_size || crew.suit_size || '-'}</span>
                        <span>{response?.boot_size || crew.boot_size || '-'}</span>
                        <span className="text-zinc-500">{formatDateTime(response?.confirmed_at || (fallbackConfirmed ? crew.ppe_size_confirmed_at : null))}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function InventoryPage() { return ( <Suspense fallback={<div>Loading...</div>}><InventoryContent /></Suspense> ) }
