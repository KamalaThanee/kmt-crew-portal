'use client'
import { ShieldCheck, Package, Clock, AlertTriangle, RefreshCw, ChevronRight, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

export default function AdminDashboard() {
  return (
    <div className="p-4 md:p-12 max-w-7xl mx-auto pb-32 pt-24 font-sans">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase italic text-white">Command Center</h1>
          <p className="text-orange-500/60 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Vessel Security & Safety</p>
        </div>
        <button className="p-3 bg-orange-600/10 border border-orange-500/20 rounded-full text-orange-500 hover:bg-orange-600 hover:text-white transition-all"><RefreshCw size={20}/></button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Pending Req', val: '0', icon: <Clock size={20}/>, href: '/admin/approvals' },
          { label: 'Low Stock', val: '23', icon: <AlertTriangle size={20}/>, href: '/admin/inventory?filter=low' },
          { label: 'Total Items', val: '709', icon: <Package size={20}/>, href: '/admin/inventory' },
          { label: 'Fleet Ready', val: '55%', icon: <ShieldCheck size={20}/>, href: '/admin/settings?tab=crews' },
        ].map((stat, i) => (
          <Link key={i} href={stat.href} className="bg-zinc-900/30 border border-orange-500/10 p-6 rounded-[32px] hover:border-orange-500/50 transition-all group relative overflow-hidden">
            <div className="text-orange-500 mb-4 group-hover:scale-110 transition-transform">{stat.icon}</div>
            <p className="text-3xl font-black text-white mb-1">{stat.val}</p>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">{stat.label}</p>
            <ArrowUpRight className="absolute top-6 right-6 text-zinc-800 group-hover:text-orange-500 transition-colors" size={20}/>
          </Link>
        ))}
      </div>

      <div className="mt-12">
        <Link href="/certificates" className="block bg-zinc-900/30 border border-orange-500/20 p-8 rounded-[40px] hover:border-orange-500 transition-all group">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-8">
               <div className="w-20 h-20 rounded-[24px] border-2 border-orange-500 flex items-center justify-center font-black text-2xl text-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.2)]">54%</div>
               <div>
                  <h3 className="text-xl font-black uppercase italic text-white">My Compliance Status</h3>
                  <p className="text-zinc-500 text-xs mt-1 uppercase font-bold tracking-wider">7 of 13 certificates valid</p>
               </div>
            </div>
            <div className="px-6 py-3 bg-white text-black rounded-2xl font-black uppercase text-[10px] tracking-widest group-hover:bg-orange-500 group-hover:text-white transition-all">
               Check My Certs
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
