"use client";
import { 
  Package, AlertTriangle, Archive, ArrowRight, BarChart3, 
  TrendingUp, Clock, History, Box, ChevronRight, RefreshCcw, X, PieChart
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../../lib/supabase";
import { toast } from "sonner";

export default function AdminDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showReport, setShowReport] = useState(false); // 🎯 State สำหรับหน้ารายงาน
  const [stats, setStats] = useState({
    lowStockCount: 0,
    totalInventory: 0,
    lastRestockDate: "No data",
    globalPendingCount: 0, certCompliance: 0,
  });
  
  const [requests, setRequests] = useState<any[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState("");

  const fetchDashboardData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    setIsRefreshing(true);
    try {
      const { data: inventory } = await supabase.from('ppe_inventory').select('quantity, threshold');
      let lowStock = 0; let totalQty = 0;
      if (inventory) {
        inventory.forEach(item => {
          totalQty += (item.quantity || 0);
          if ((item.quantity || 0) <= (item.threshold || 0)) lowStock++;
        });
      }
      const { data: restock } = await supabase.from('restock_history').select('created_at').order('created_at', { ascending: false }).limit(1);
      const lastDate = restock && restock.length > 0 ? new Date(restock[0].created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : "N/A";
      const { count: pendingCount } = await supabase.from('ppe_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending');
      setStats({ lowStockCount: lowStock, totalInventory: totalQty, lastRestockDate: lastDate, globalPendingCount: pendingCount || 0 });
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
        if (!selectedMonth) setSelectedMonth(months[0]);
      }
      if (silent) toast.success("Refreshed");
    } catch (error) { console.error(error); }
    setIsLoading(false);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  useEffect(() => { fetchDashboardData(); }, []);

  // 🎯 Logic คำนวณ Analytics: สินค้าไหนถูกเบิกเยอะที่สุดในเดือนที่เลือก
  const topItems = useMemo(() => {
    if (!selectedMonth) return [];
    const filteredReqs = requests.filter(r => {
      const d = new Date(r.created_at);
      return `${d.toLocaleString('en-US', { month: 'short' })} ${d.getFullYear()}` === selectedMonth && r.status !== 'rejected';
    });
    const itemMap: Record<string, number> = {};
    filteredReqs.forEach(r => {
      r.items?.forEach((item: any) => {
        const key = item.item_name;
        itemMap[key] = (itemMap[key] || 0) + 1;
      });
    });
    return Object.entries(itemMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [requests, selectedMonth]);

  const usage = useMemo(() => {
    if (!selectedMonth) return { totalRequests: 0, itemsIssued: 0 };
    const filteredReqs = requests.filter(r => {
      const d = new Date(r.created_at);
      return `${d.toLocaleString('en-US', { month: 'short' })} ${d.getFullYear()}` === selectedMonth;
    });
    let itemsIssued = 0;
    filteredReqs.forEach(r => { if (r.status !== 'rejected' && r.items) itemsIssued += r.items.length; });
    return { totalRequests: filteredReqs.length, itemsIssued };
  }, [requests, selectedMonth]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-500 font-black animate-pulse">LOADING...</div>;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-32 pt-2 md:pt-6 font-sans">
      <div className="mb-8 flex justify-between items-center">
        <div><h1 className="text-3xl font-black uppercase italic text-white leading-none">Dashboard</h1><p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-2">Vessel Hub</p></div>
        <div className="flex gap-2">
           {/* 🎯 ปุ่มดูรายงานวิเคราะห์ */}
           <button onClick={() => setShowReport(true)} className="bg-emerald-600/10 p-3 rounded-2xl border border-emerald-500/20 text-emerald-500 active:scale-90 transition-all"><PieChart size={24}/></button>
           <button onClick={() => fetchDashboardData(true)} className="bg-blue-600/10 p-3 rounded-2xl border border-blue-500/20 text-blue-500 active:scale-90 transition-all"><RefreshCcw className={isRefreshing ? 'animate-spin' : ''} size={24}/></button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <Link href="/admin/approvals" className="bg-slate-900 border border-amber-500/30 p-5 rounded-[32px] flex flex-col justify-between h-40 shadow-amber-500/5 hover:border-amber-500 transition-all active:scale-95">
           <div className="flex justify-between items-start"><div className="bg-amber-500/20 p-2.5 rounded-xl text-amber-500"><Clock size={20}/></div><ChevronRight size={16} className="text-slate-700"/></div>
           <div><p className="text-2xl font-black text-white">{stats.globalPendingCount}</p><p className="text-[10px] font-black uppercase text-amber-500">Pending</p></div>
        </Link>
        {/* 🎯 ปุ่ม Low Stock พร้อม Filter อัตโนมัติ */}
        <Link href="/admin/inventory?filter=low" className="bg-slate-900 border border-red-500/30 p-5 rounded-[32px] flex flex-col justify-between h-40 shadow-red-500/5 hover:border-red-500 transition-all active:scale-95">
           <div className="flex justify-between items-start"><div className="bg-red-500/20 p-2.5 rounded-xl text-red-500"><AlertTriangle size={20} className={stats.lowStockCount > 0 ? "animate-pulse" : ""}/></div><ChevronRight size={16} className="text-slate-700"/></div>
           <div><p className="text-2xl font-black text-white">{stats.lowStockCount}</p><p className="text-[10px] font-black uppercase text-red-500">Low Stock</p></div>
        </Link>
        <Link href="/admin/inventory" className="bg-slate-900 border border-blue-500/30 p-5 rounded-[32px] flex flex-col justify-between h-40 shadow-blue-500/5 hover:border-blue-500 transition-all active:scale-95">
           <div className="flex justify-between items-start"><div className="bg-blue-500/20 p-2.5 rounded-xl text-blue-500"><Box size={20}/></div><ChevronRight size={16} className="text-slate-700"/></div>
           <div><p className="text-2xl font-black text-white">{stats.totalInventory}</p><p className="text-[10px] font-black uppercase text-blue-500">Total Items</p></div>
        </Link>
        <Link href="/admin/restock" className="bg-slate-900 border border-emerald-500/30 p-5 rounded-[32px] flex flex-col justify-between h-40 shadow-emerald-500/5 hover:border-emerald-500 transition-all active:scale-95">
           <div className="flex justify-between items-start"><div className="bg-emerald-500/20 p-2.5 rounded-xl text-emerald-500"><History size={20}/></div><ChevronRight size={16} className="text-slate-700"/></div>
           <div><p className="text-lg font-black text-white">{stats.lastRestockDate}</p><p className="text-[10px] font-black uppercase text-emerald-500">Last Restock</p></div>
        </Link>

        {/* Cert Compliance - Purple */}
        <Link href="/certificates" className="bg-slate-900 border border-purple-500/30 p-5 rounded-[32px] flex flex-col justify-between h-40 shadow-purple-500/5 hover:border-purple-500 transition-all active:scale-95">
           <div className="flex justify-between items-start">
              <div className="bg-purple-500/20 p-2.5 rounded-xl text-purple-500"><FileBadge size={20}/></div>
              <ChevronRight size={16} className="text-slate-700"/>
           </div>
           <div>
              <p className="text-2xl font-black text-white">{stats.certCompliance}%</p>
              <p className="text-[10px] font-black uppercase text-purple-500">Cert Compliance</p>
           </div>
        </Link>
        </Link>

        {/* Cert Compliance - Purple */}
        <Link href="/certificates" className="bg-slate-900 border border-purple-500/30 p-5 rounded-[32px] flex flex-col justify-between h-40 shadow-purple-500/5 hover:border-purple-500 transition-all active:scale-95">
           <div className="flex justify-between items-start">
              <div className="bg-purple-500/20 p-2.5 rounded-xl text-purple-500"><FileBadge size={20}/></div>
              <ChevronRight size={16} className="text-slate-700"/>
           </div>
           <div>
              <p className="text-2xl font-black text-white">{stats.certCompliance}%</p>
              <p className="text-[10px] font-black uppercase text-purple-500">Cert Compliance</p>
           </div>
      </div>
        </Link>

        {/* Cert Compliance - Purple */}
        <Link href="/certificates" className="bg-slate-900 border border-purple-500/30 p-5 rounded-[32px] flex flex-col justify-between h-40 shadow-purple-500/5 hover:border-purple-500 transition-all active:scale-95">
           <div className="flex justify-between items-start">
              <div className="bg-purple-500/20 p-2.5 rounded-xl text-purple-500"><FileBadge size={20}/></div>
              <ChevronRight size={16} className="text-slate-700"/>
           </div>
           <div>
              <p className="text-2xl font-black text-white">{stats.certCompliance}%</p>
              <p className="text-[10px] font-black uppercase text-purple-500">Cert Compliance</p>
           </div>

        </Link>

        {/* Cert Compliance - Purple */}
        <Link href="/certificates" className="bg-slate-900 border border-purple-500/30 p-5 rounded-[32px] flex flex-col justify-between h-40 shadow-purple-500/5 hover:border-purple-500 transition-all active:scale-95">
           <div className="flex justify-between items-start">
              <div className="bg-purple-500/20 p-2.5 rounded-xl text-purple-500"><FileBadge size={20}/></div>
              <ChevronRight size={16} className="text-slate-700"/>
           </div>
           <div>
              <p className="text-2xl font-black text-white">{stats.certCompliance}%</p>
              <p className="text-[10px] font-black uppercase text-purple-500">Cert Compliance</p>
           </div>
      <div className="bg-slate-900/50 border border-white/5 rounded-[40px] p-6 space-y-6">
        <div className="flex justify-between items-center border-b border-white/5 pb-4"><h2 className="text-sm font-black uppercase tracking-widest text-slate-300">Usage Stats</h2>
        <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-black/40 border border-white/10 text-white text-[10px] font-black uppercase rounded-full px-4 py-2 outline-none">{availableMonths.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
        <div className="grid grid-cols-2 gap-8"><div className="space-y-1"><p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Requests</p><p className="text-3xl font-black text-white">{usage.totalRequests}</p></div>
        <div className="space-y-1 text-right"><p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Items Issued</p><p className="text-3xl font-black text-blue-500">{usage.itemsIssued}</p></div></div>
      </div>

      {/* 📊 ANALYTICS MODAL */}
      {showReport && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex flex-col p-6 animate-in slide-in-from-bottom duration-300">
           <div className="flex justify-between items-center mb-10"><h2 className="text-2xl font-black uppercase italic italic flex items-center gap-3"><BarChart3 className="text-emerald-500"/> Item Analysis</h2><button onClick={() => setShowReport(false)} className="p-3 bg-white/5 rounded-full"><X/></button></div>
           <div className="space-y-8 flex-1 overflow-y-auto">
              <div><p className="text-[10px] font-black text-slate-500 uppercase mb-6 tracking-widest text-center">Top 5 Items Requested in {selectedMonth}</p>
              <div className="space-y-6 max-w-sm mx-auto">
                {topItems.length === 0 ? <p className="text-center text-slate-600">No data for this period</p> : 
                 topItems.map(([name, count], idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex justify-between text-[11px] font-black uppercase"><span>{name}</span><span className="text-emerald-400">{count} Units</span></div>
                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full transition-all duration-1000" style={{ width: `${(count / topItems[0][1]) * 100}%` }}></div>
                    </div>
                  </div>
                ))}
              </div></div>
           </div>
           <div className="p-6 bg-blue-600/10 rounded-3xl border border-blue-500/20 text-center"><p className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em]">Data Analysis Complete</p></div>
        </div>
      )}
    </div>
  );
}
