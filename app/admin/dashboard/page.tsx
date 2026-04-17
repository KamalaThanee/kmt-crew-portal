"use client";
import { Package, AlertTriangle, Archive, ArrowRight, BarChart3, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function AdminDashboard() {
  const [selectedMonth, setSelectedMonth] = useState("Jan 2024");

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-6xl mx-auto">
      
      {/* 1. USAGE SUMMARY SECTION */}
      <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500/20 p-2.5 rounded-xl text-blue-400"><BarChart3 size={24} /></div>
            <div>
              <h1 className="text-xl font-black text-white uppercase tracking-wider">Usage Summary</h1>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Monthly PPE Consumption</p>
            </div>
          </div>
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-slate-950 border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 transition-colors font-bold cursor-pointer"
          >
            <option value="Jan 2024">January 2024</option>
            <option value="Feb 2024">February 2024</option>
            <option value="Mar 2024">March 2024</option>
          </select>
        </div>

        {/* Dummy Stats for Usage Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-950/50 p-4 rounded-2xl border border-white/5">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Total Items Issued</p>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-black text-white">142</span>
              <span className="text-emerald-500 flex items-center text-xs font-bold"><TrendingUp size={14} className="mr-1"/> 12%</span>
            </div>
          </div>
          <div className="bg-slate-950/50 p-4 rounded-2xl border border-white/5">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Most Used Category</p>
            <div className="flex items-end justify-between">
              <span className="text-xl font-black text-blue-400">Hand Protection</span>
            </div>
          </div>
          <div className="bg-slate-950/50 p-4 rounded-2xl border border-white/5">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Pending Approvals</p>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-black text-orange-400">3</span>
            </div>
          </div>
          <div className="bg-slate-950/50 p-4 rounded-2xl border border-white/5">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Restock Value (Est.)</p>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-black text-white">$1,250</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. QUICK ACTION CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        
        {/* Low Stock */}
        <Link href="/admin/inventory?filter=low-stock" className="bg-gradient-to-br from-slate-900 to-slate-950 border border-white/10 p-6 rounded-3xl flex flex-col gap-6 hover:border-red-500/50 transition-all group relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-red-500/10 rounded-full blur-2xl group-hover:bg-red-500/20 transition-all"></div>
          <div className="flex justify-between items-start relative z-10">
            <div className="bg-red-500/20 p-4 rounded-2xl text-red-400 group-hover:scale-110 transition-all shadow-lg"><AlertTriangle size={28} /></div>
            <span className="text-4xl font-black text-white tracking-tighter">5</span>
          </div>
          <div className="relative z-10">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Low Stock Alerts</h3>
            <p className="text-xs text-slate-500 uppercase font-bold mt-1 tracking-widest">Items below threshold</p>
          </div>
        </Link>

        {/* Total Inventory */}
        <Link href="/admin/inventory" className="bg-gradient-to-br from-slate-900 to-slate-950 border border-white/10 p-6 rounded-3xl flex flex-col gap-6 hover:border-blue-500/50 transition-all group relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
          <div className="flex justify-between items-start relative z-10">
            <div className="bg-blue-500/20 p-4 rounded-2xl text-blue-400 group-hover:scale-110 transition-all shadow-lg"><Package size={28} /></div>
            <span className="text-4xl font-black text-white tracking-tighter">248</span>
          </div>
          <div className="relative z-10">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Inventory Master</h3>
            <p className="text-xs text-slate-500 uppercase font-bold mt-1 tracking-widest">All items by category</p>
          </div>
        </Link>

        {/* Restock History */}
        <Link href="/admin/restock" className="bg-gradient-to-br from-slate-900 to-slate-950 border border-white/10 p-6 rounded-3xl flex flex-col gap-6 hover:border-emerald-500/50 transition-all group relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
          <div className="flex justify-between items-start relative z-10">
            <div className="bg-emerald-500/20 p-4 rounded-2xl text-emerald-400 group-hover:scale-110 transition-all shadow-lg"><Archive size={28} /></div>
            <ArrowRight className="text-slate-600 group-hover:text-emerald-400 transition-colors mt-2" size={24} />
          </div>
          <div className="relative z-10">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Restock Mgmt</h3>
            <p className="text-[10px] text-emerald-500 uppercase font-black mt-1 tracking-widest bg-emerald-500/10 inline-block px-2 py-1 rounded-md">Last: 15 Jan 2024</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
