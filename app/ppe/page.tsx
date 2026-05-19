'use client'

import { toast } from 'sonner'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { applyPpeRequestUserFilter } from '@/lib/ppeRequests'
import { isAdminRole } from '@/lib/roles'
import {
  HardHat,
  Headphones,
  Eye,
  Wind,
  Hand,
  Footprints,
  MoreHorizontal,
  Plus,
  Lock,
  Shirt,
  ShieldAlert,
  ChevronDown,
  Package,
  History as HistoryIcon,
  FileSpreadsheet,
  Medal,
  Users,
} from 'lucide-react'
import { HistoryMetricCard } from '@/components/history/HistoryMetricCard'
import { HistoryDesktopTable } from '@/components/history/HistoryDesktopTable'
import { HistoryFilterBar } from '@/components/history/HistoryFilterBar'
import { HistoryMobileCards } from '@/components/history/HistoryMobileCards'
import {
  PAGE_SIZE,
  type HistoryRow,
  filterHistoryRowsByItem,
  getCrewOptions,
  getHistoryExportRows,
  getHistorySummary,
  getItemOptions,
  getMonthOptions,
  getYearOptions,
  runHistoryQuery,
} from '@/lib/history'

type PpeView = 'issue' | 'history'

function PPEContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [inventory, setInventory] = useState<any[]>([])
  const [activeCat, setActiveCat] = useState('All')
  const [expandedItemName, setExpandedItemName] = useState<string | null>(null)
  const [quotas, setQuotas] = useState({ suit: 0, boot: 0 })
  const [activeView, setActiveView] = useState<PpeView>('issue')

  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([])
  const [summaryRows, setSummaryRows] = useState<HistoryRow[]>([])
  const [rowCount, setRowCount] = useState(0)
  const [summaryRowCount, setSummaryRowCount] = useState(0)
  const [adminNameMap, setAdminNameMap] = useState<Record<string, string>>({})
  const [searchCrew, setSearchCrew] = useState('')
  const [searchItem, setSearchItem] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState('all')
  const [page, setPage] = useState(0)

  const viewParam = searchParams.get('view')

  useEffect(() => {
    if (viewParam === 'history') setActiveView('history')
    else setActiveView('issue')
  }, [viewParam])

  useEffect(() => {
    setPage(0)
  }, [searchCrew, searchItem, statusFilter, monthFilter, yearFilter])

  const syncView = (nextView: PpeView) => {
    setActiveView(nextView)
    if (nextView === 'history') router.replace('/ppe?view=history', { scroll: false })
    else router.replace('/ppe', { scroll: false })
  }

  useEffect(() => {
    setMounted(true)
    const uStr = localStorage.getItem('kmt_user')
    if (!uStr) {
      router.push('/login')
      return
    }

    const u = JSON.parse(uStr)
    setUser(u)
    const nextIsAdmin = isAdminRole(u.position)
    setIsAdmin(nextIsAdmin)
    if (!nextIsAdmin) {
      toast.error('PPE issue is now managed by admin only')
      router.replace('/my-requests')
      return
    }

    supabase.from('ppe_inventory').select('*').order('item_name').then(({ data }) => data && setInventory(data))

    const fetchCrewLookup = async () => {
      const crewsRes = await supabase.from('crews').select('id, full_name').order('full_name')
      if (!crewsRes.error) {
        setAdminNameMap(
          Object.fromEntries(
            (crewsRes.data || []).map((crew: { id: string; full_name: string }) => [
              String(crew.id),
              crew.full_name,
            ]),
          ),
        )
      }
    }

    const fetchMyQuotas = async () => {
      const currentYear = new Date().getFullYear()
      const reqQuery = await applyPpeRequestUserFilter(
        supabase
          .from('ppe_requests')
          .select('items')
          .neq('status', 'rejected')
          .gte('created_at', `${currentYear}-01-01`),
        u,
      )
      const { data: reqs } = await reqQuery
      let sc = 0
      let bc = 0
      reqs?.forEach((r: any) => {
        r.items?.forEach((i: any) => {
          if (i.item_name.toLowerCase().includes('suit')) sc += 1
          if (i.item_name.toLowerCase().includes('safety boot') && !i.item_name.toLowerCase().includes('rubber')) bc += 1
        })
      })
      setQuotas({ suit: sc, boot: bc })
    }

    void fetchCrewLookup()
    void fetchMyQuotas()
  }, [router])

  useEffect(() => {
    if (!mounted || !isAdmin || activeView !== 'history') return

    let active = true

    const fetchHistoryRows = async () => {
      setHistoryLoading(true)
      const queryContext = {
        supabaseClient: supabase,
        statusFilter,
        monthFilter,
        yearFilter,
        searchCrew,
        page,
      }

      const [result, summaryResult] = await Promise.all([
        runHistoryQuery({ ...queryContext, includeStatusFilter: true, paginate: true }),
        runHistoryQuery({ ...queryContext, includeStatusFilter: false, paginate: false }),
      ])

      if (!active) return

      if (result.error) {
        console.error('History load failed:', result.error)
        toast.error(result.error.message || 'Unable to load issue history')
        setHistoryRows([])
        setRowCount(0)
      } else {
        setHistoryRows(((result.data || []) as unknown) as HistoryRow[])
        setRowCount(result.count || 0)
      }

      if (summaryResult.error) {
        console.error('History summary load failed:', summaryResult.error)
        setSummaryRows([])
        setSummaryRowCount(0)
      } else {
        setSummaryRows(((summaryResult.data || []) as unknown) as HistoryRow[])
        setSummaryRowCount(summaryResult.count || 0)
      }

      setHistoryLoading(false)
    }

    void fetchHistoryRows()

    return () => {
      active = false
    }
  }, [mounted, isAdmin, activeView, page, searchCrew, searchItem, statusFilter, monthFilter, yearFilter])

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

  const sizeOrder = ['XXXS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL']

  const compareSize = (a: any, b: any) => {
    const sa = String(a || '').trim().toUpperCase()
    const sb = String(b || '').trim().toUpperCase()

    const freeRank: Record<string, number> = { 'FREE SIZE': 9998, FREESIZE: 9998, FS: 9998 }
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

  const groupedInventory = useMemo(() => {
    const filtered = inventory.filter((item) => activeCat === 'All' || item.category === activeCat)
    const groups: Record<string, any[]> = {}

    filtered.forEach((item) => {
      if (!groups[item.item_name]) groups[item.item_name] = []

      if (isAdmin) groups[item.item_name].push(item)
      else {
        const name = item.item_name.toLowerCase()
        const isSuit = name.includes('suit')
        const isBoot = name.includes('safety boot') && !name.includes('rubber')

        if (isSuit) {
          if (String(item.size) === String(user?.suit_size) && String(item.color) === String(user?.suit_color)) groups[item.item_name].push(item)
        } else if (isBoot) {
          if (String(item.size) === String(user?.boot_size)) groups[item.item_name].push(item)
        } else {
          groups[item.item_name].push(item)
        }
      }
    })

    return Object.entries(groups)
      .filter(([_, v]) => v.length > 0)
      .map(([name, variants]) => ({
        name,
        variants: variants.sort((a, b) => {
          const colorA = String(a.color || '').toUpperCase()
          const colorB = String(b.color || '').toUpperCase()
          if (colorA !== colorB) return colorA.localeCompare(colorB, undefined, { numeric: true })
          return compareSize(a.size, b.size)
        }),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [inventory, activeCat, isAdmin, user])

  const addToCart = (item: any) => {
    const currentCart = JSON.parse(localStorage.getItem('kmt_cart') || '[]')
    const inCartOfThis = currentCart.filter((i: any) => i.id === item.id).length
    if (inCartOfThis >= Number(item.quantity)) return toast.error('Stock limit reached')

    const name = item.item_name.toLowerCase()
    const isSuit = name.includes('suit')
    const isBoot = name.includes('safety boot') && !name.includes('rubber')
    if (!isAdmin && (isSuit || isBoot)) {
      const limit = isSuit ? 2 : 1
      const currentQuota = isSuit ? quotas.suit : quotas.boot
      const inCartItems = currentCart.filter((i: any) => {
        const currentName = i.item_name.toLowerCase()
        return isSuit ? currentName.includes('suit') : (currentName.includes('safety boot') && !currentName.includes('rubber'))
      }).length
      if (currentQuota + inCartItems >= limit) return toast.error(`Quota limit reached (${limit}/year)`)
    }

    const newCart = [...currentCart, { ...item, cartId: Date.now() }]
    localStorage.setItem('kmt_cart', JSON.stringify(newCart))
    window.dispatchEvent(new CustomEvent('cart-updated', { detail: newCart.length }))
    toast.success(`${item.item_name} added`)
  }

  const filteredHistoryRows = useMemo(() => filterHistoryRowsByItem(historyRows, searchItem), [historyRows, searchItem])
  const summaryContextRows = useMemo(() => filterHistoryRowsByItem(summaryRows, searchItem), [summaryRows, searchItem])
  const monthOptions = useMemo(() => getMonthOptions(), [])
  const yearOptions = useMemo(() => getYearOptions(), [])
  const crewOptions = useMemo(() => getCrewOptions(historyRows, adminNameMap), [historyRows, adminNameMap])
  const itemOptions = useMemo(() => getItemOptions(historyRows), [historyRows])
  const historySummary = useMemo(
    () => getHistorySummary(summaryContextRows, summaryRowCount, searchItem),
    [summaryContextRows, summaryRowCount, searchItem],
  )
  const exportRows = useMemo(() => getHistoryExportRows(filteredHistoryRows, adminNameMap), [filteredHistoryRows, adminNameMap])

  const handleExportExcel = async () => {
    if (!exportRows.length) {
      toast.error('No history rows to export')
      return
    }

    const XLSX = await import('xlsx')
    const worksheet = XLSX.utils.json_to_sheet(exportRows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Issue History')
    const stamp = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(workbook, `kmt-issue-history-${stamp}.xlsx`)
  }

  if (!mounted || !user) return null

  return (
    <div className="mx-auto max-w-[1380px] px-4 pb-32 pt-28 font-sans text-[10px] font-bold uppercase text-[#17120f] md:px-8">
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="mb-8 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-black italic flex items-center gap-3">
              <ShieldAlert className="text-orange-500" size={36} />
              Issue PPE
            </h1>
            <p className="mt-2 flex items-center gap-2 tracking-[0.22em] text-[#5f5147]">
              <ShieldAlert size={12} />
              Storekeeper direct issue and issue tracking
            </p>
          </div>

          <div className="flex flex-col gap-3 xl:items-end">
            <div className="grid w-full grid-cols-2 rounded-[28px] border border-[#efd7c2] bg-white/95 p-1.5 text-[10px] font-black uppercase tracking-tight text-[#6f6259] shadow-[0_18px_50px_rgba(80,52,16,0.08)] xl:w-[420px]">
              <button
                type="button"
                onClick={() => syncView('issue')}
                className={`rounded-[22px] px-4 py-3 transition-all ${activeView === 'issue' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/25' : 'hover:bg-[#fff4ea] hover:text-[#14100d]'}`}
              >
                Issue Catalog
              </button>
              <button
                type="button"
                onClick={() => syncView('history')}
                className={`flex items-center justify-center gap-2 rounded-[22px] px-4 py-3 transition-all ${activeView === 'history' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/25' : 'hover:bg-[#fff4ea] hover:text-[#14100d]'}`}
              >
                <HistoryIcon size={14} />
                Issue History
              </button>
            </div>

            {activeView === 'history' && (
              <button
                onClick={handleExportExcel}
                className="flex items-center justify-center gap-2 rounded-2xl border border-[#f0c9a1] bg-[#fff1e6] px-5 py-3 text-xs font-black uppercase text-[#d16b0f] xl:min-w-[190px]"
              >
                <FileSpreadsheet size={16} />
                Export Excel
              </button>
            )}
          </div>
        </div>

        {activeView === 'issue' ? (
          <>
            <div className="flex flex-wrap items-center gap-2 py-2">
              <button onClick={() => setActiveCat('All')} className={`rounded-2xl border px-5 py-3 font-black text-[10px] uppercase transition-all ${activeCat === 'All' ? 'border-orange-600 bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'border-[#efd7c2] bg-white text-[#6f6259] hover:border-[#efbf8e] hover:text-[#14100d]'}`}>All</button>
              {categoryConfig.map((cat) => (
                <button key={cat.name} onClick={() => setActiveCat(cat.name)} className={`flex items-center gap-3 whitespace-nowrap rounded-2xl border px-5 py-3 font-black text-[10px] uppercase transition-all ${activeCat === cat.name ? 'border-orange-600 bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'border-[#efd7c2] bg-white text-[#6f6259] hover:border-[#efbf8e] hover:text-[#14100d]'}`}>
                  <cat.icon size={16} /> {cat.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {groupedInventory.map((group) => {
                const isExpanded = expandedItemName === group.name
                return (
                  <div key={group.name} className={`overflow-hidden rounded-[32px] border bg-white/95 transition-all shadow-[0_18px_50px_rgba(80,52,16,0.06)] ${isExpanded ? 'border-orange-400 bg-[#fffaf6] shadow-[0_22px_55px_rgba(80,52,16,0.1)]' : 'border-[#efd7c2] hover:-translate-y-0.5 hover:border-[#efbf8e]'}`}>
                    <button onClick={() => setExpandedItemName(isExpanded ? null : group.name)} className="w-full p-6 flex items-center justify-between outline-none">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#f5dcc5] bg-[#fff4ea] text-orange-500"><Package size={24} /></div>
                        <div className="text-left">
                          <h3 className="text-sm font-black uppercase italic leading-tight text-[#14100d]">{group.name}</h3>
                          <p className="mt-1 text-[9px] font-bold uppercase text-[#7b6d63]">{group.variants.length} Options Available</p>
                        </div>
                      </div>
                      <ChevronDown className={`transition-transform ${isExpanded ? 'rotate-180 text-orange-500' : 'text-[#8a7669]'}`} />
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-6 space-y-2 animate-in slide-in-from-top-2">
                        {group.variants.map((v, vIdx) => {
                          const currentCart = JSON.parse(localStorage.getItem('kmt_cart') || '[]')
                          const inCart = currentCart.filter((i: any) => i.id === v.id).length
                          const currentStock = v.quantity - inCart
                          return (
                            <div key={vIdx} className="flex items-center justify-between rounded-2xl border border-[#f0ddd0] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(80,52,16,0.04)]">
                              <div>
                                <p className="text-[10px] font-black uppercase text-[#14100d]">{v.color} | {v.size}</p>
                                <p className={`mt-1 text-[8px] font-bold ${currentStock > 0 ? 'text-emerald-600' : 'text-red-500'}`}>{currentStock > 0 ? `${currentStock} available` : 'Out of stock'}</p>
                              </div>
                              <button onClick={() => addToCart(v)} disabled={currentStock <= 0} className="w-9 h-9 bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-800 text-white rounded-xl flex items-center justify-center transition-all active:scale-90">
                                {currentStock > 0 ? <Plus size={18} /> : <Lock size={14} />}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <>
            <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
              <HistoryMetricCard
                label="Issues"
                value={historySummary.requestCount}
                description="All issue records in this view"
                tone="amber"
                active={statusFilter === 'all'}
                onClick={() => setStatusFilter('all')}
              />
              <HistoryMetricCard
                label="Top Item"
                value={historySummary.topItem}
                description={historySummary.topItemCount > 0 ? `${historySummary.topItemCount} issues in the selected period` : 'No item data in this view'}
                tone="violet"
                icon={<Medal size={16} />}
                valueClassName="text-lg"
              />
              <HistoryMetricCard
                label="Top Crew"
                value={historySummary.topCrew}
                description={historySummary.topCrewCount > 0 ? `${historySummary.topCrewCount} issues in the selected period` : 'No crew activity in this view'}
                tone="cyan"
                icon={<Users size={16} />}
                valueClassName="text-lg"
              />
            </div>

            <HistoryFilterBar
              crewOptions={crewOptions}
              itemOptions={itemOptions}
              monthFilter={monthFilter}
              monthOptions={monthOptions}
              searchCrew={searchCrew}
              searchItem={searchItem}
              statusFilter={statusFilter}
              yearFilter={yearFilter}
              yearOptions={yearOptions}
              onMonthFilterChange={(nextMonth) => {
                setMonthFilter(nextMonth)
                if (nextMonth !== 'all' && yearFilter === 'all') setYearFilter(String(new Date().getFullYear()))
              }}
              onSearchCrewChange={setSearchCrew}
              onSearchItemChange={setSearchItem}
              onStatusFilterChange={setStatusFilter}
              onYearFilterChange={setYearFilter}
            />

            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="text-[11px] font-bold uppercase tracking-widest text-[#7c6b60]">
                {filteredHistoryRows.length} shown {searchItem ? 'after item filter' : ''} / {rowCount} matching records
              </div>
              {historyLoading && (
                <div className="rounded-full border border-[#bfd4ff] bg-[#eff5ff] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#2862cf]">
                  Loading page...
                </div>
              )}
            </div>

            <HistoryDesktopTable rows={filteredHistoryRows} adminNameMap={adminNameMap} />
            <HistoryMobileCards rows={filteredHistoryRows} adminNameMap={adminNameMap} />

            <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-[28px] border border-[#efd7c2] bg-white/92 p-4 shadow-[0_18px_45px_rgba(80,52,16,0.06)] md:flex-row">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#7c6b60]">
                Page {page + 1} of {Math.max(1, Math.ceil(rowCount / PAGE_SIZE))}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={page === 0 || historyLoading}
                  onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                  className="rounded-2xl border border-[#efd7c2] bg-[#fff6ee] px-5 py-3 text-xs font-black uppercase text-[#6f6259] transition hover:border-[#efbf8e] hover:text-[#14100d] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={(page + 1) * PAGE_SIZE >= rowCount || historyLoading}
                  onClick={() => setPage((prev) => prev + 1)}
                  className="rounded-2xl border border-[#f0c9a1] bg-[#fff1e6] px-5 py-3 text-xs font-black uppercase text-[#d16b0f] transition hover:border-[#e8ab64] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function PPEPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PPEContent />
    </Suspense>
  )
}

