'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  FileBadge, Users, User, AlertTriangle, ChevronRight, 
  ShieldCheck, Package, RefreshCw, Clock, Activity, ArrowUpRight 
} from 'lucide-react'
import Link from 'next/link'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ pending: 5, lowStock: 12, compliance: 85, total: 48 });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-32 pt-20 text-white font-sans">
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-4xl font-black tracking-tighter uppercase italic">Control Hub</h1>
        <div className="p-2 bg-white/5 rounded-full border border-white/10"><RefreshCw size={20}/></div>
      </div>

      {/* 🎯 BENTO GRID LAYOUT */}
      <div className="grid grid-cols-4 grid-rows-2 gap-4 h-[600px]">
        
        {/* กล่องใหญ่ (Main Metric) */}
        <div className="col-span-4 md:col-span-2 row-span-2 bg-blue-600 rounded-[32px] p-8 flex flex-col justify-between relative overflow-hidden group">
           <ShieldCheck size={200} className="absolute -right-20 -bottom-20 text-white/10 group-hover:scale-110 transition-transform" />
           <div>
              <p className="text-blue-100 font-bold uppercase tracking-widest text-xs mb-2">Fleet Readiness</p>
              <h2 className="text-7xl font-black">{stats.compliance}%</h2>
           </div>
           <Link href="/admin/settings?tab=crews" className="bg-white text-blue-600 w-fit px-6 py-3 rounded-2xl font-black uppercase text-xs flex items-center gap-2">
              Manage Fleet <ArrowUpRight size={16}/>
           </Link>
        </div>

        {/* กล่อง Pending (สีเหลือง) */}
        <div className="col-span-2 md:col-span-1 bg-zinc-900 border border-white/5 rounded-[32px] p-6 flex flex-col justify-between hover:border-amber-500/50 transition-all">
           <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-500"><Clock/></div>
           <div>
              <p className="text-3xl font-black">{stats.pending}</p>
              <p className="text-zinc-500 text-[10px] font-bold uppercase">Pending Req</p>
           </div>
        </div>

        {/* กล่อง Low Stock (สีแดง) */}
        <div className="col-span-2 md:col-span-1 bg-zinc-900 border border-white/5 rounded-[32px] p-6 flex flex-col justify-between hover:border-red-500/50 transition-all">
           <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center text-red-500"><AlertTriangle/></div>
           <div>
              <p className="text-3xl font-black">{stats.lowStock}</p>
              <p className="text-zinc-500 text-[10px] font-bold uppercase">Low Stock</p>
           </div>
        </div>

        {/* กล่องยาว (Inventory สรุป) */}
        <div className="col-span-4 md:col-span-2 bg-zinc-900 border border-white/5 rounded-[32px] p-6 flex items-center justify-between group hover:bg-zinc-800/50 transition-all">
           <div className="flex items-center gap-6">
              <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500"><Package size={28}/></div>
              <div>
                 <p className="text-2xl font-black">{stats.total}</p>
                 <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Crew Members Onboard</p>
              </div>
           </div>
           <ChevronRight className="text-zinc-700 group-hover:text-white transition-all"/>
        </div>

      </div>
    </div>
  )
}
