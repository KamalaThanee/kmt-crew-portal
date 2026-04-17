"use client";
import { Package, AlertTriangle, Clock, Archive, ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function AdminDashboard() {
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("kmt_user") || "{}");
    setUserName(user.full_name || "Admin");
  }, []);

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-6xl mx-auto">
      <div className="bg-gradient-to-r from-blue-900/40 to-slate-900 border border-blue-500/20 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5"><ShieldCheck size={120} /></div>
        <div className="space-y-2 relative z-10">
          <h1 className="text-3xl font-black text-white uppercase tracking-wider flex items-center gap-3">
            Welcome back, <span className="text-blue-400">{userName.split(' ')[0]}</span>
          </h1>
          <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">System Overview & Management</p>
        </div>
        <Link href="/admin/requests" className="relative z-10 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold uppercase tracking-wider text-sm transition-all flex items-center gap-2 active:scale-95 shadow-[0_0_20px_rgba(37,99,235,0.3)]">
          Review Requests <ArrowRight size={16} />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Link href="/admin/requests" className="bg-gradient-to-br from-slate-900 to-slate-950 border border-white/10 p-6 rounded-3xl flex flex-col gap-6 hover:border-orange-500/50 transition-all group cursor-pointer relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl group-hover:bg-orange-500/20 transition-all"></div>
          <div className="flex justify-between items-start relative z-10">
            <div className="bg-orange-500/20 p-4 rounded-2xl text-orange-400 group-hover:scale-110 group-hover:bg-orange-500 group-hover:text-white transition-all shadow-lg"><Clock size={28} /></div>
            <span className="text-4xl font-black text-white tracking-tighter">12</span>
          </div>
          <div className="relative z-10">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Pending Requests</h3>
            <p className="text-xs text-slate-500 uppercase font-bold mt-1 tracking-widest">Needs Approval</p>
          </div>
        </Link>

        <Link href="/admin/inventory?filter=low-stock" className="bg-gradient-to-br from-slate-900 to-slate-950 border border-white/10 p-6 rounded-3xl flex flex-col gap-6 hover:border-red-500/50 transition-all group cursor-pointer relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-red-500/10 rounded-full blur-2xl group-hover:bg-red-500/20 transition-all"></div>
          <div className="flex justify-between items-start relative z-10">
            <div className="bg-red-500/20 p-4 rounded-2xl text-red-400 group-hover:scale-110 group-hover:bg-red-500 group-hover:text-white transition-all shadow-lg"><AlertTriangle size={28} /></div>
            <span className="text-4xl font-black text-white tracking-tighter">5</span>
          </div>
          <div className="relative z-10">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Low Stock</h3>
            <p className="text-xs text-slate-500 uppercase font-bold mt-1 tracking-widest">Action Required</p>
          </div>
        </Link>

        <Link href="/admin/inventory" className="bg-gradient-to-br from-slate-900 to-slate-950 border border-white/10 p-6 rounded-3xl flex flex-col gap-6 hover:border-blue-500/50 transition-all group cursor-pointer relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
          <div className="flex justify-between items-start relative z-10">
            <div className="bg-blue-500/20 p-4 rounded-2xl text-blue-400 group-hover:scale-110 group-hover:bg-blue-500 group-hover:text-white transition-all shadow-lg"><Package size={28} /></div>
            <span className="text-4xl font-black text-white tracking-tighter">248</span>
          </div>
          <div className="relative z-10">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Inventory</h3>
            <p className="text-xs text-slate-500 uppercase font-bold mt-1 tracking-widest">Available Items</p>
          </div>
        </Link>

        <Link href="/admin/restock" className="bg-gradient-to-br from-slate-900 to-slate-950 border border-white/10 p-6 rounded-3xl flex flex-col gap-6 hover:border-emerald-500/50 transition-all group cursor-pointer relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
          <div className="flex justify-between items-start relative z-10">
            <div className="bg-emerald-500/20 p-4 rounded-2xl text-emerald-400 group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-lg"><Archive size={28} /></div>
            <ArrowRight className="text-slate-600 group-hover:text-emerald-400 transition-colors mt-2" size={24} />
          </div>
          <div className="relative z-10">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Restock Mgmt</h3>
            <p className="text-xs text-slate-500 uppercase font-bold mt-1 tracking-widest">Upload & History</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
