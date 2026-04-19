"use client";
import { 
  Package, AlertTriangle, Archive, ArrowRight, BarChart3, 
  TrendingUp, Clock, CheckCircle2, ChevronRight, Box, History 
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

export default function AdminDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    lowStockCount: 0,
    totalInventory: 0,
    lastRestockDate: "No data",
    globalPendingCount: 0, // 🎯 เพิ่มยอด Pending ทั้งหมด (ไม่แยกเดือน)
  });
  
  const [requests, setRequests] = useState<any[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState("");

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // 1. ดึงข้อมูล Inventory & Low Stock
      const { data: inventory } = await supabase.from('ppe_inventory').select('quantity, threshold');
      let lowStock = 0;
      let totalQty = 0;
      if (inventory) {
        inventory.forEach(item => {
          totalQty += (item.quantity || 0);
          if ((item.quantity || 0) <= (item.threshold || 0)) lowStock++;
        });
      }

      // 2. ดึงข้อมูล Restock ล่าสุด
      const { data: restock } = await supabase.from('restock_history')
        .select('created_at').order('created_at', { ascending: false }).limit(1);
      
      const lastDate = restock && restock.length > 0 
        ? new Date(restock[0].created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
        : "N/A";

      // 3. ดึงยอด Pending ทั้งหมด (Global)
      const { count: pendingCount } = await supabase.from('ppe_requests')
        .select('*', { count: 'exact', head: true }).eq('status', 'pending');

      setStats({ 
        lowStockCount: lowStock, 
        totalInventory: totalQty, 
        lastRestockDate: lastDate,
        globalPendingCount: pendingCount || 0
      });

      // 4. ดึงข้อมูล Requests สำหรับสรุปรายเดือน
      const { data: reqs } = await supabase.from('ppe_requests').select('created_at, items, status');
      if (reqs) {
        setRequests(reqs);
        const months = Array.from(new Set(reqs.map(r => {
          const d = new Date(r.created_at);
          return `${d.toLocaleString('en-US', { month: 'short' })} ${d.getFullYear()}`;
        })));
        if (months.length === 0) {
          const now = new Date();
          months.push(`${now.toLocaleString('en-US', { month: 'short' })} ${now.getFullYear()}`);
        }
        months.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        setAvailableMonths(months);
        setSelectedMonth(months[0]);
      }
    } catch (error) {
      console.error("Error:", error);
    }
    setIsLoading(false);
  };

  const calculateUsage = () => {
    if (!selectedMonth) return { totalRequests: 0, itemsIssued: 0 };
    const filteredReqs = requests.filter(r => {
      const d = new Date(r.created_at);
      return `${d.toLocaleString('en-US', { month: 'short' })} ${d.getFullYear()}` === selectedMonth;
    });
    let itemsIssued = 0;
    filteredReqs.forEach(r => {
      if (r.status !== 'rejected' && r.items) {
        itemsIssued += Array.isArray(r.items) ? r.items.length : 0;
      }
    });
    return { totalRequests: filteredReqs.length, itemsIssued };
  };

  const usage = calculateUsage();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse uppercase tracking-widest text-xs">Loading Command Center...</div>;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-32 pt-2 md:pt-6 font-sans">
      
      {/* 🚀 Header Section */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black uppercase italic text-white leading-none">Dashboard</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-2">Vessel Operation Hub</p>
        </div>
        <div className="bg-blue-600/10 p-3 rounded-2xl border border-blue-500/20">
           <BarChart3 className="text-blue-500" size={24}/>
        </div>
      </div>

      {/* 🎯 2x2 Metric Tiles Section (The Star of the Show) */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        
        {/* Pending Card - Yellow */}
        <Link href="/admin/approvals" className="bg-slate-900 border border-amber-500/30 p-5 rounded-[32px] flex flex-col justify-between h-40 shadow-lg shadow-amber-500/5 hover:border-amber-500 transition-all active:scale-95">
           <div className="flex justify-between items-start">
              <div className="bg-amber-500/20 p-2.5 rounded-xl text-amber-500"><Clock size={20}/></div>
              <ChevronRight size={16} className="text-slate-700"/>
           </div>
           <div>
              <p className="text-2xl font-black text-white leading-none">{stats.globalPendingCount}</p>
              <p className="text-[10px] font-black uppercase tracking-tight text-amber-500 mt-1">Pending Req</p>
           </div>
        </Link>

        {/* Low Stock Card - Red */}
        <Link href="/admin/inventory" className="bg-slate-900 border border-red-500/30 p-5 rounded-[32px] flex flex-col justify-between h-40 shadow-lg shadow-red-500/5 hover:border-red-500 transition-all active:scale-95">
           <div className="flex justify-between items-start">
              <div className="bg-red-500/20 p-2.5 rounded-xl text-red-500"><AlertTriangle size={20} className={stats.lowStockCount > 0 ? "animate-pulse" : ""}/></div>
              <ChevronRight size={16} className="text-slate-700"/>
           </div>
           <div>
              <p className="text-2xl font-black text-white leading-none">{stats.lowStockCount}</p>
              <p className="text-[10px] font-black uppercase tracking-tight text-red-500 mt-1">Low Stock</p>
           </div>
        </Link>

        {/* Total Inventory - Blue */}
        <Link href="/admin/inventory" className="bg-slate-900 border border-blue-500/30 p-5 rounded-[32px] flex flex-col justify-between h-40 shadow-lg shadow-blue-500/5 hover:border-blue-500 transition-all active:scale-95">
           <div className="flex justify-between items-start">
              <div className="bg-blue-500/20 p-2.5 rounded-xl text-blue-500"><Box size={20}/></div>
              <ChevronRight size={16} className="text-slate-700"/>
           </div>
           <div>
              <p className="text-2xl font-black text-white leading-none">{stats.totalInventory}</p>
              <p className="text-[10px] font-black uppercase tracking-tight text-blue-500 mt-1">Total Items</p>
           </div>
        </Link>

        {/* Restock History - Green */}
        <Link href="/admin/restock" className="bg-slate-900 border border-emerald-500/30 p-5 rounded-[32px] flex flex-col justify-between h-40 shadow-lg shadow-emerald-500/5 hover:border-emerald-500 transition-all active:scale-95">
           <div className="flex justify-between items-start">
              <div className="bg-emerald-500/20 p-2.5 rounded-xl text-emerald-500"><History size={20}/></div>
              <ChevronRight size={16} className="text-slate-700"/>
           </div>
           <div>
              <p className="text-lg font-black text-white leading-none truncate">{stats.lastRestockDate}</p>
              <p className="text-[10px] font-black uppercase tracking-tight text-emerald-500 mt-1">Last Restock</p>
           </div>
        </Link>

      </div>

      {/* 📊 Monthly Summary Section (Compact) */}
      <div className="bg-slate-900/50 border border-white/5 rounded-[40px] p-6 space-y-6">
        <div className="flex justify-between items-center border-b border-white/5 pb-4">
           <h2 className="text-sm font-black uppercase tracking-widest text-slate-300">Usage Stats</h2>
           <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-black/40 border border-white/10 text-white text-[10px] font-black uppercase rounded-full px-4 py-2 outline-none appearance-none"
          >
            {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-8">
           <div className="space-y-1">
              <p className="text-[9px] font-black uppercase text-slate-500 tracking-tighter">Request Vol.</p>
              <p className="text-3xl font-black text-white">{usage.totalRequests}</p>
           </div>
           <div className="space-y-1 text-right">
              <p className="text-[9px] font-black uppercase text-slate-500 tracking-tighter">Items Issued</p>
              <p className="text-3xl font-black text-blue-500">{usage.itemsIssued}</p>
           </div>
        </div>

        <div className="bg-blue-600/5 border border-blue-500/10 p-4 rounded-2xl flex items-center justify-between">
           <div className="flex items-center gap-3">
              <TrendingUp className="text-emerald-500" size={18}/>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">System Integrity</span>
           </div>
           <span className="text-[10px] font-black text-emerald-500 uppercase bg-emerald-500/10 px-2 py-1 rounded-md tracking-tighter italic">Normal</span>
        </div>
      </div>

    </div>
  );
}
