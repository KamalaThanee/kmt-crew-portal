"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { AlertCircle, CheckSquare, PackagePlus, ArrowLeft, BarChart3, Clock } from "lucide-react";
import Link from "next/link";

interface DashboardStats {
  pending: number;
  lowStock: any[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({ pending: 0, lowStock: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      const { count } = await supabase.from('ppe_requests').select('*', { count: 'exact', head: true }).eq('status', 'Pending');
      const { data: lowItems } = await supabase.from('ppe_inventory').select('*').lt('quantity', 5);
      
      setStats({ 
        pending: count || 0, 
        lowStock: (lowItems as any[]) || [] 
      });
      setLoading(false);
    }
    loadStats();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-12">
          <div>
            <Link href="/" className="flex items-center gap-2 text-zinc-500 hover:text-white transition mb-4 text-sm">
              <ArrowLeft size={16} /> Back to Crew Portal
            </Link>
            <h1 className="text-4xl font-black tracking-tighter">ADMIN <span className="text-emerald-500">DASHBOARD</span></h1>
          </div>
          <div className="bg-zinc-900 px-4 py-2 rounded-2xl border border-zinc-800 text-xs font-bold text-zinc-400">
            SYSTEM STATUS: ONLINE
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card: Pending Requests */}
          <Link href="/admin/requests" className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2rem] hover:border-blue-500 transition group">
            <div className="flex justify-between items-start mb-6">
              <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-500"><Clock size={32} /></div>
              <span className="text-[10px] font-black bg-blue-500 text-white px-2 py-1 rounded">ACTION REQUIRED</span>
            </div>
            <h3 className="text-zinc-500 text-xs font-black uppercase tracking-widest">Pending Approvals</h3>
            <p className="text-5xl font-black mt-2 group-hover:scale-110 transition-transform origin-left">{stats.pending}</p>
          </Link>

          {/* Card: Low Stock */}
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2rem]">
            <div className="flex justify-between items-start mb-6">
              <div className="p-4 bg-rose-500/10 rounded-2xl text-rose-500"><AlertCircle size={32} /></div>
            </div>
            <h3 className="text-zinc-500 text-xs font-black uppercase tracking-widest">Low Stock Items</h3>
            <p className="text-5xl font-black mt-2 text-rose-500">{stats.lowStock.length}</p>
            <div className="mt-4 space-y-2">
              {stats.lowStock.slice(0, 2).map((item) => (
                <div key={item.id} className="text-[10px] bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                  {item.item_name} ({item.size}) - {item.quantity} left
                </div>
              ))}
            </div>
          </div>

          {/* Card: Restock Link */}
          <Link href="/admin/restock" className="bg-emerald-600 p-8 rounded-[2rem] hover:bg-emerald-500 transition shadow-xl shadow-emerald-500/20 group">
            <div className="flex justify-between items-start mb-6 text-white">
              <div className="p-4 bg-white/20 rounded-2xl"><PackagePlus size={32} /></div>
            </div>
            <h3 className="text-emerald-100 text-xs font-black uppercase tracking-widest">Inventory Management</h3>
            <p className="text-2xl font-black mt-2 leading-tight">RESTOCK & <br/>EVIDENCE</p>
            <p className="mt-4 text-xs font-bold text-emerald-900 underline">Manage Stock History →</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
