'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isNoExpiryDate } from '@/lib/certificates'
import { applyPpeRequestUserFilter } from '@/lib/ppeRequests'
import {
  AlertTriangle,
  ArrowRight,
  Clock3,
  LayoutDashboard,
  Package,
  RefreshCw,
} from 'lucide-react'

const normalize = (str: string) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '')

const getMonthStart = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

type MetricCard = {
  label: string
  value: string | number
  note: string
  color: string
  href?: string
  icon: any
}

export default function AdminDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [personal, setPersonal] = useState<any>({ progress: 0, okCount: 0, reqCount: 0, expired: 0, warning: 0, lastStatus: 'None' })
  const [quota, setQuota] = useState({ suit: 0, boot: 0 })
  const [overview, setOverview] = useState<any>({
    pending: 0,
    stalePending: 0,
    lowStock: 0,
    totalItems: 0,
    receivedThisMonth: 0,
    compliance: 0,
    lastRestockDate: 'N/A',
    topItems: [],
    topCrew: [],
    funnel: { pending: 0, approved: 0, received: 0, rejected: 0 },
  })

  useEffect(() => {
    const userStr = localStorage.getItem('kmt_user')
    if (!userStr) {
      router.replace('/login')
      return
    }

    const parsed = JSON.parse(userStr)
    setUser(parsed)
    fetchAdminData(parsed)
  }, [router])

  async function fetchAdminData(currentUser: any) {
    setLoading(true)

    const myReqsQuery = await applyPpeRequestUserFilter(
      supabase.from('ppe_requests').select('*').neq('status', 'rejected').order('created_at', { ascending: false }),
      currentUser,
    )

    const monthStart = getMonthStart()

    const [matrixRes, allCertsRes, invRes, restockRes, myReqsRes, reqRes] = await Promise.all([
      supabase.from('cert_matrix').select('*'),
      supabase.from('crew_certs').select('*'),
      supabase.from('ppe_inventory').select('quantity, threshold'),
      supabase.from('restock_history').select('created_at').order('created_at', { ascending: false }).limit(1),
      myReqsQuery,
      supabase.from('ppe_requests').select('*').order('created_at', { ascending: false }),
    ])

    const matrix = matrixRes.data || []
    const allCerts = allCertsRes.data || []
    const inventory = invRes.data || []
    const lastRestock = restockRes.data || []
    const requests = reqRes.data || []

    const userPosNorm = normalize(currentUser.position)
    const myRequired = matrix.filter((row: any) => normalize(row.position) === userPosNorm && row.requirement_type === 'P')
    const myCerts = allCerts.filter((cert: any) => cert.crew_id === currentUser.id)
    const today = new Date()

    let okCount = 0
    let expired = 0
    let warning = 0
    let suitCount = 0
    let bootCount = 0

    myRequired.forEach((req: any) => {
      const uploaded = myCerts.find((cert: any) => normalize(cert.cert_name) === normalize(req.cert_name))
      if (!uploaded) return

      if (isNoExpiryDate(uploaded.expiry_date)) {
        okCount++
        return
      }

      const expDate = new Date(uploaded.expiry_date)
      const dayDiff = (expDate.getTime() - today.getTime()) / 86400000
      if (dayDiff < 0) expired++
      else if (dayDiff <= 90) {
        warning++
        okCount++
      } else okCount++
    })

    const itemMap = new Map<string, number>()
    const crewMap = new Map<string, number>()
    const funnel = { pending: 0, approved: 0, received: 0, rejected: 0 }
    let stalePending = 0
    let receivedThisMonth = 0

    requests.forEach((req: any) => {
      const status = String(req.status || 'pending').toLowerCase()
      if (status in funnel) funnel[status as keyof typeof funnel]++

      if (status === 'pending') {
        const ageHours = (Date.now() - new Date(req.created_at).getTime()) / 3600000
        if (ageHours >= 24) stalePending++
      }

      if (status === 'received' && req.received_at && new Date(req.received_at) >= monthStart) {
        receivedThisMonth++
      }

      const crewName = req.crew_name || req.requester_name || req.full_name || 'Unknown Crew'
      const items = Array.isArray(req.items) ? req.items : []

      items.forEach((item: any) => {
        const itemName = item.item_name || 'Unknown Item'
        itemMap.set(itemName, (itemMap.get(itemName) || 0) + 1)
        crewMap.set(crewName, (crewMap.get(crewName) || 0) + 1)
      })
    })

    ;(myReqsRes.data || []).forEach((req: any) => {
      ;(req.items || []).forEach((item: any) => {
        const name = String(item.item_name || '').toLowerCase()
        if (name.includes('suit')) suitCount++
        if (name.includes('safety boot') && !name.includes('rubber')) bootCount++
      })
    })

    const topItems = [...itemMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))

    const topCrew = [...crewMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))

    setPersonal({
      progress: myRequired.length > 0 ? Math.round((okCount / myRequired.length) * 100) : 0,
      okCount,
      reqCount: myRequired.length,
      expired,
      warning,
      lastStatus: myReqsRes.data?.[0]?.status || 'None',
    })
    setQuota({ suit: suitCount, boot: bootCount })

    setOverview({
      pending: funnel.pending,
      stalePending,
      lowStock: inventory.filter((item: any) => (item.quantity || 0) <= (item.threshold || 0)).length,
      totalItems: inventory.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0),
      receivedThisMonth,
      compliance: myRequired.length > 0 ? Math.round((okCount / myRequired.length) * 100) : 0,
      lastRestockDate: lastRestock.length > 0 ? new Date(lastRestock[0].created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'N/A',
      topItems,
      topCrew,
      funnel,
    })

    setLoading(false)
  }

  const metricCards: MetricCard[] = useMemo(
    () => [
      {
        label: 'Pending Requests',
        value: overview.pending,
        note: overview.stalePending > 0 ? `${overview.stalePending} waiting more than 24h` : 'No overdue approvals',
        color: 'amber',
        href: '/admin/approvals',
        icon: Clock3,
      },
      {
        label: 'Low Stock',
        value: overview.lowStock,
        note: `${overview.totalItems} units total on hand`,
        color: 'red',
        href: '/admin/inventory?filter=low',
        icon: AlertTriangle,
      },
      {
        label: 'PPE Quota',
        value: `${quota.suit}/2`,
        note: `Safety boots ${quota.boot}/1 this year`,
        color: 'emerald',
        href: '/my-requests',
        icon: Package,
      },
    ],
    [overview, quota],
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center app-shell text-orange-500 font-black animate-pulse uppercase tracking-widest text-xs">
        Loading Command Center...
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-32 pt-20 font-sans">
      <div className="mb-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-orange-500">Operations Desk</p>
          <h1 className="mt-3 text-3xl md:text-5xl font-black italic tracking-tight flex items-center gap-3">
            <LayoutDashboard className="text-orange-500" size={34} />
            Command Center
          </h1>
          <p className="mt-3 app-text-muted normal-case text-sm max-w-2xl">
            Monitor queue pressure, issue movement, and the people or items demanding attention first.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="app-surface-soft rounded-[28px] border border-orange-500/15 bg-gradient-to-r from-orange-500/10 to-transparent px-5 py-4">
            <p className="text-[8px] uppercase tracking-[0.3em] app-text-muted">Last Restock</p>
            <p className="mt-2 text-lg font-black">{overview.lastRestockDate}</p>
          </div>
          <button onClick={() => fetchAdminData(user)} className="app-surface rounded-2xl border p-4 hover:bg-orange-600 hover:text-white transition-all">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {metricCards.map((card) => {
          const Icon = card.icon
          const colorClass =
            card.color === 'amber'
              ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
              : card.color === 'red'
                ? 'text-red-400 bg-red-500/10 border-red-500/20'
                : card.color === 'emerald'
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  : 'text-blue-400 bg-blue-500/10 border-blue-500/20'

          const content = (
            <div className="app-surface rounded-[30px] border p-5 shadow-[0_18px_50px_rgba(0,0,0,0.24)] hover:border-orange-500/20 transition-all h-full">
              <div className="flex items-start justify-between">
                <div className={`p-3 rounded-2xl border ${colorClass}`}>
                  <Icon size={18} />
                </div>
                <ArrowRight size={16} className="app-text-muted" />
              </div>
              <p className="mt-8 app-text-muted text-[10px] uppercase tracking-[0.2em]">{card.label}</p>
              <p className="mt-2 text-3xl font-black">{card.value}</p>
              <p className="mt-2 text-[11px] normal-case app-text-soft">{card.note}</p>
            </div>
          )

          return card.href ? <Link key={card.label} href={card.href}>{content}</Link> : <div key={card.label}>{content}</div>
        })}
      </div>

      <div className="mb-8 grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <div className="app-surface-strong rounded-[36px] border p-5 md:p-6 shadow-[0_24px_70px_rgba(0,0,0,0.26)]">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <p className="text-[9px] uppercase tracking-[0.3em] app-text-muted">Request Movement</p>
              <h2 className="mt-2 text-xl font-black italic">Workflow Funnel</h2>
            </div>
            <Link href="/admin/history" className="text-xs uppercase tracking-[0.2em] text-orange-400 hover:text-orange-300">
              Open History
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ['Pending', overview.funnel.pending, 'amber'],
              ['Approved', overview.funnel.approved, 'blue'],
              ['Received', overview.funnel.received, 'emerald'],
              ['Rejected', overview.funnel.rejected, 'red'],
            ].map(([label, value, tone]) => (
              <div key={String(label)} className="app-surface rounded-[22px] border p-4">
                <p className="text-[9px] uppercase tracking-[0.2em] app-text-muted">{label}</p>
                <p className={`mt-3 text-2xl font-black ${tone === 'amber' ? 'text-amber-400' : tone === 'blue' ? 'text-blue-400' : tone === 'emerald' ? 'text-emerald-400' : 'text-red-400'}`}>{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
            <Link href="/admin/approvals" className="app-surface rounded-[24px] border p-4 hover:border-amber-500/30 transition-all">
              <p className="text-[9px] uppercase tracking-[0.2em] app-text-muted">Approval Queue</p>
              <p className="mt-2 text-lg font-black">{overview.pending}</p>
              <p className="mt-2 text-[11px] normal-case app-text-soft">
                {overview.stalePending > 0 ? `${overview.stalePending} requests older than 24 hours` : 'All pending requests are still fresh'}
              </p>
            </Link>
            <Link href="/admin/history" className="app-surface rounded-[24px] border p-4 hover:border-blue-500/30 transition-all">
              <p className="text-[9px] uppercase tracking-[0.2em] app-text-muted">Completed This Month</p>
              <p className="mt-2 text-lg font-black">{overview.receivedThisMonth}</p>
              <p className="mt-2 text-[11px] normal-case app-text-soft">Requests fully received and closed this month</p>
            </Link>
            <Link href="/certificates" className="app-surface rounded-[24px] border p-4 hover:border-emerald-500/30 transition-all">
              <p className="text-[9px] uppercase tracking-[0.2em] app-text-muted">Certificate Readiness</p>
              <p className="mt-2 text-lg font-black">{personal.okCount}/{personal.reqCount}</p>
              <p className="mt-2 text-[11px] normal-case app-text-soft">Open compliance view and check missing or expiring certs</p>
            </Link>
          </div>
        </div>

        <div className="app-surface-strong rounded-[36px] border p-5 md:p-6 shadow-[0_24px_70px_rgba(0,0,0,0.26)]">
          <p className="text-[9px] uppercase tracking-[0.3em] app-text-muted">My Readiness & Quota</p>
          <div className="mt-5 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="relative w-20 h-20 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90">
                <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-white/5" />
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="transparent"
                  strokeDasharray="214"
                  strokeDashoffset={214 - (personal.progress / 100) * 214}
                  className="text-blue-500"
                />
              </svg>
              <span className="absolute text-xs font-black">{personal.progress}%</span>
            </div>
            <div>
              <p className="text-xl font-black">{personal.okCount}/{personal.reqCount}</p>
              <p className="text-[11px] normal-case app-text-soft">Certificates currently compliant for your role</p>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-red-500/15 bg-red-500/10 p-4">
              <p className="text-[9px] uppercase tracking-[0.15em] text-red-300">Expired</p>
              <p className="mt-2 text-2xl font-black">{personal.expired}</p>
            </div>
            <div className="rounded-2xl border border-amber-500/15 bg-amber-500/10 p-4">
              <p className="text-[9px] uppercase tracking-[0.15em] text-amber-300">90 Days</p>
              <p className="mt-2 text-2xl font-black">{personal.warning}</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/10 p-4">
              <p className="text-[9px] uppercase tracking-[0.15em] text-emerald-300">Boiler Suit</p>
              <p className="mt-2 text-2xl font-black">{quota.suit}/2</p>
            </div>
            <div className="rounded-2xl border border-blue-500/15 bg-blue-500/10 p-4">
              <p className="text-[9px] uppercase tracking-[0.15em] text-blue-300">Safety Boots</p>
              <p className="mt-2 text-2xl font-black">{quota.boot}/1</p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-white/5 bg-black/10 px-4 py-3">
            <p className="text-[9px] uppercase tracking-[0.15em] app-text-muted">Last PPE Request</p>
            <p className="mt-2 text-sm font-black uppercase">{personal.lastStatus}</p>
          </div>
        </div>
      </div>

      <div className="app-surface-strong rounded-[36px] border p-5 md:p-6 shadow-[0_24px_70px_rgba(0,0,0,0.26)]">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <p className="text-[9px] uppercase tracking-[0.3em] app-text-muted">Monthly Signal</p>
            <h2 className="mt-2 text-xl font-black italic">Most Requested This Month</h2>
          </div>
          <Link href="/admin/history" className="text-xs uppercase tracking-[0.2em] text-orange-400 hover:text-orange-300">
            Explore full history
          </Link>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="space-y-3">
            {overview.topItems.length === 0 && <div className="app-surface rounded-2xl border p-5 app-text-muted text-sm normal-case">No issued items in the current dataset yet.</div>}
            {overview.topItems.map((item: any, index: number) => (
              <div key={item.name} className="app-surface rounded-[24px] border px-4 py-4 grid grid-cols-[40px_1fr_auto] items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-400 flex items-center justify-center font-black">{index + 1}</div>
                <div>
                  <p className="font-black text-sm">{item.name}</p>
                  <p className="app-text-muted text-[11px] normal-case">Highest request pressure this month</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black">{item.count}</p>
                  <p className="text-[9px] uppercase tracking-[0.15em] app-text-muted">requests</p>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {overview.topCrew.length === 0 && <div className="app-surface rounded-2xl border p-5 app-text-muted text-sm normal-case">No crew activity captured yet.</div>}
            {overview.topCrew.map((crew: any, index: number) => (
              <div key={crew.name} className="app-surface rounded-[24px] border px-4 py-4 grid grid-cols-[40px_1fr_auto] items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-black">{index + 1}</div>
                <div>
                  <p className="font-black text-sm">{crew.name}</p>
                  <p className="app-text-muted text-[11px] normal-case">Most request activity in the current view</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black">{crew.count}</p>
                  <p className="text-[9px] uppercase tracking-[0.15em] app-text-muted">items</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
