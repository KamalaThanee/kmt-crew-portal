'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  ShieldCheck, Package, Clock, AlertTriangle, RefreshCw, ChevronRight, User, FileBadge
} from 'lucide-react'
import Link from 'next/link'

export default function AdminDashboard() {
  return (
    <div className="p-6 md:p-12 max-w-6xl mx-auto pb-32 pt-24 text-white font-sans">
      <div className="flex justify-between items-center mb-12">
        <div>
          <h1 className="text-3xl font-black tracking-tighter uppercase italic">Control Hub</h1>
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">Vessel Operation Overview</p>
        </div>
        <button className="p-3 bg-zinc-900 border border-white/10 rounded-full hover:bg-zinc-800 transition-colors"><RefreshCw size={18}/></button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Pending Req', val: '0', icon: <Clock/>, color: 'text-amber-500', href: '/admin/approvals' },
          { label: 'Low Stock', val: '23', icon: <AlertTriangle/>, color: 'text-red-500', href: '/admin/inventory?filter=low' },
          { label: 'Total Items', val: '709', icon: <Package/>, color: 'text-blue-500', href: '/admin/inventory' },
          { label: 'Fleet Ready', val: '55%', icon: <ShieldCheck/>, color: 'text-purple-500', href: '/admin/settings?tab=crews' },
        ].map((stat, i) => (
          <Link key={i} href={stat.href} className="bg-zinc-900/50 border border-white/5 p-6 rounded-2xl hover:border-white/20 transition-all group">
            <div className={`${stat.color} mb-4 group-hover:scale-110 transition-transform w-fit`}>{stat.icon}</div>
            <p className="text-2xl font-black mb-1">{stat.val}</p>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">{stat.label}</p>
          </Link>
        ))}
      </div>
      
      {/* ส่วนโชว์ My Personal แบบย่อในสไตล์ 1 */}
      <div className="mt-12">
        <h2 className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.3em] mb-6">My Personal Status</h2>
        <Link href="/certificates" className="bg-zinc-900 border border-white/5 p-8 rounded-3xl flex flex-col md:flex-row items-center justify-between hover:border-white/20 transition-all">
          <div className="flex items-center gap-8">
            <div className="w-16 h-16 rounded-full border-4 border-blue-500 border-t-zinc-800 flex items-center justify-center font-black text-sm">54%</div>
            <div>
              <p className="text-lg font-black italic uppercase">My Readiness</p>
              <p className="text-zinc-500 text-xs">7/13 Certificates are valid</p>
            </div>
          </div>
          <ChevronRight className="text-zinc-700 hidden md:block" />
        </Link>
      </div>
    </div>
  )
}
