"use client";
import { Package, AlertTriangle, Archive, ArrowRight, BarChart3 } from "lucide-react";
import Link from "next/link";

export default function AdminDashboard() {
  return (
    <div className="p-4 md:p-8 space-y-8 max-w-6xl mx-auto">
      
      {/* Usage Summary (รอต่อ DB) */}
      <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 space-y-4">
        <div className="flex justify-between items-center border-b border-white/5 pb-4">
          <h1 className="text-xl font-black text-white uppercase flex items-center gap-2"><BarChart3/> Usage Summary</h1>
          <select className="bg-slate-950 border border-white/10 text-white rounded-lg px-4 py-2 text-sm">
            <option>Loading Month...</option>
          </select>
        </div>
        <div className="text-center py-8 text-slate-500 text-sm">
          Awaiting Database connection to calculate actual usage...
        </div>
      </div>

      {/* Action Cards (แก้ลิงก์ 404 แล้ว) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/admin/inventory?filter=low-stock" className="bg-slate-900 border border-red-500/20 p-6 rounded-3xl hover:bg-slate-800 transition-all">
          <AlertTriangle size={28} className="text-red-500 mb-4" />
          <h3 className="text-white font-bold uppercase">Low Stock Alerts</h3>
        </Link>

        <Link href="/admin/inventory" className="bg-slate-900 border border-blue-500/20 p-6 rounded-3xl hover:bg-slate-800 transition-all">
          <Package size={28} className="text-blue-500 mb-4" />
          <h3 className="text-white font-bold uppercase">Total Inventory</h3>
        </Link>

        <Link href="/admin/restock" className="bg-slate-900 border border-emerald-500/20 p-6 rounded-3xl hover:bg-slate-800 transition-all">
          <Archive size={28} className="text-emerald-500 mb-4" />
          <h3 className="text-white font-bold uppercase">Restock History</h3>
        </Link>
      </div>
    </div>
  );
}
