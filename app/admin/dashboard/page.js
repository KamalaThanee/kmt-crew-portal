"use client";
import { Package, AlertTriangle, Clock, Archive } from "lucide-react";
import Link from "next/link";

export default function AdminDashboard() {
  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-black text-white uppercase tracking-wider">Overview</h1>
        <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Dashboard & Management</p>
      </div>

      {/* Grid Layout รองรับมือถือ (1 column) และ Desktop (2-4 columns) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Pending Card */}
        <Link href="/admin/pending" className="bg-white/5 border border-white/10 p-6 rounded-2xl flex flex-col gap-4 hover:bg-white/10 transition-colors group cursor-pointer">
          <div className="flex justify-between items-start">
            <div className="bg-orange-500/20 p-3 rounded-xl text-orange-500 group-hover:scale-110 transition-transform">
              <Clock size={24} />
            </div>
            <span className="text-3xl font-black text-white">12</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase">Pending Requests</h3>
            <p className="text-xs text-slate-500 uppercase font-bold mt-1">Needs Approval</p>
          </div>
        </Link>

        {/* Low Stock Card */}
        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl flex flex-col gap-4 hover:bg-white/10 transition-colors group cursor-pointer">
          <div className="flex justify-between items-start">
            <div className="bg-red-500/20 p-3 rounded-xl text-red-500 group-hover:scale-110 transition-transform">
              <AlertTriangle size={24} />
            </div>
            <span className="text-3xl font-black text-white">5</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase">Low Stock Items</h3>
            <p className="text-xs text-slate-500 uppercase font-bold mt-1">Action Required</p>
          </div>
        </div>

        {/* Total Inventory Card */}
        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl flex flex-col gap-4 hover:bg-white/10 transition-colors group cursor-pointer">
          <div className="flex justify-between items-start">
            <div className="bg-blue-500/20 p-3 rounded-xl text-blue-500 group-hover:scale-110 transition-transform">
              <Package size={24} />
            </div>
            <span className="text-3xl font-black text-white">248</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase">Total Inventory</h3>
            <p className="text-xs text-slate-500 uppercase font-bold mt-1">Available PPE Items</p>
          </div>
        </div>

        {/* Restock History Card */}
        <Link href="/admin/restock" className="bg-white/5 border border-white/10 p-6 rounded-2xl flex flex-col gap-4 hover:bg-white/10 transition-colors group cursor-pointer">
          <div className="flex justify-between items-start">
            <div className="bg-emerald-500/20 p-3 rounded-xl text-emerald-500 group-hover:scale-110 transition-transform">
              <Archive size={24} />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase">Restock History</h3>
            <p className="text-xs text-slate-500 uppercase font-bold mt-1">Upload Receipt & Logs</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
