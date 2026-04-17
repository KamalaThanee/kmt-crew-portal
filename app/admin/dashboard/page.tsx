"use client";
import { Package, AlertTriangle, Archive, ArrowRight, BarChart3, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function AdminDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    lowStockCount: 0,
    totalInventory: 0,
    lastRestockDate: "No data",
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
      // 1. ดึงข้อมูลคลัง (Inventory & Low Stock)
      const { data: inventory } = await supabase.from('ppe_inventory').select('quantity, threshold');
      let lowStock = 0;
      let totalQty = 0;
      if (inventory) {
        inventory.forEach(item => {
          totalQty += (item.quantity || 0);
          if ((item.quantity || 0) < (item.threshold || 1)) lowStock++;
        });
      }

      // 2. ดึงข้อมูลประวัติรับของล่าสุด (Restock)
      const { data: restock } = await supabase.from('restock_history')
        .select('created_at').order('created_at', { ascending: false }).limit(1);
      
      const lastDate = restock && restock.length > 0 
        ? new Date(restock[0].created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : "No record";

      setStats({ lowStockCount: lowStock, totalInventory: totalQty, lastRestockDate: lastDate });

      // 3. ดึงข้อมูลคำขอเบิก (เพื่อทำ Usage Summary)
      const { data: reqs } = await supabase.from('ppe_requests').select('created_at, items, status');
      if (reqs) {
        setRequests(reqs);
        
        // สร้างรายการเดือนที่มีการเบิก (เช่น "Apr 2026")
        const months = Array.from(new Set(reqs.map(r => {
          const d = new Date(r.created_at);
          return `${d.toLocaleString('en-US', { month: 'short' })} ${d.getFullYear()}`;
        })));
        
        // ถ้าไม่มีข้อมูลเลย ให้ใส่เดือนปัจจุบัน
        if (months.length === 0) {
          const now = new Date();
          months.push(`${now.toLocaleString('en-US', { month: 'short' })} ${now.getFullYear()}`);
        }
        
        // เรียงเดือนจากใหม่ไปเก่า (คร่าวๆ)
        months.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        setAvailableMonths(months);
        setSelectedMonth(months[0]); // เลือกเดือนล่าสุดเป็นค่าเริ่มต้น
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    }
    setIsLoading(false);
  };

  // คำนวณ Usage Summary ตามเดือนที่เลือก
  const calculateUsage = () => {
    if (!selectedMonth) return { totalRequests: 0, pending: 0, itemsIssued: 0 };
    
    const filteredReqs = requests.filter(r => {
      const d = new Date(r.created_at);
      return `${d.toLocaleString('en-US', { month: 'short' })} ${d.getFullYear()}` === selectedMonth;
    });

    const pending = filteredReqs.filter(r => r.status === 'pending').length;
    let itemsIssued = 0;
    
    filteredReqs.forEach(r => {
      if (r.status !== 'rejected' && r.items) {
        // ประเมินว่า 1 object ใน array คือ 1 ชิ้น (ถ้าตารางเก็บจำนวนด้วย ค่อยคูณจำนวนเข้าไป)
        itemsIssued += Array.isArray(r.items) ? r.items.length : 0;
      }
    });

    return { totalRequests: filteredReqs.length, pending, itemsIssued };
  };

  const usage = calculateUsage();

  if (isLoading) return <div className="p-10 text-center text-white font-bold">Loading Dashboard Data...</div>;

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-6xl mx-auto pt-24">
      
      {/* 1. USAGE SUMMARY SECTION */}
      <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 md:p-8 space-y-6">
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
            {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-950/50 p-4 rounded-2xl border border-white/5">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Total Requests</p>
            <span className="text-3xl font-black text-white">{usage.totalRequests}</span>
          </div>
          <div className="bg-slate-950/50 p-4 rounded-2xl border border-white/5">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Items Claimed</p>
            <span className="text-3xl font-black text-blue-400">{usage.itemsIssued}</span>
          </div>
          <div className="bg-slate-950/50 p-4 rounded-2xl border border-white/5">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Pending in {selectedMonth}</p>
            <span className="text-3xl font-black text-orange-400">{usage.pending}</span>
          </div>
          <div className="bg-slate-950/50 p-4 rounded-2xl border border-white/5">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Status</p>
            <span className="text-emerald-500 flex items-center text-sm font-bold"><TrendingUp size={16} className="mr-1"/> Active</span>
          </div>
        </div>
      </div>

      {/* 2. QUICK ACTION CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <Link href="/admin/inventory?filter=low-stock" className="bg-slate-900 border border-white/10 p-6 rounded-3xl flex flex-col gap-6 hover:border-red-500/50 transition-all group relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-red-500/10 rounded-full blur-2xl group-hover:bg-red-500/20 transition-all"></div>
          <div className="flex justify-between items-start relative z-10">
            <div className="bg-red-500/20 p-4 rounded-2xl text-red-400 group-hover:scale-110 transition-all"><AlertTriangle size={28} /></div>
            <span className="text-4xl font-black text-white">{stats.lowStockCount}</span>
          </div>
          <div className="relative z-10">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Low Stock Alerts</h3>
            <p className="text-xs text-slate-500 uppercase font-bold mt-1 tracking-widest">Items below threshold</p>
          </div>
        </Link>

        <Link href="/admin/inventory" className="bg-slate-900 border border-white/10 p-6 rounded-3xl flex flex-col gap-6 hover:border-blue-500/50 transition-all group relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
          <div className="flex justify-between items-start relative z-10">
            <div className="bg-blue-500/20 p-4 rounded-2xl text-blue-400 group-hover:scale-110 transition-all"><Package size={28} /></div>
            <span className="text-4xl font-black text-white">{stats.totalInventory}</span>
          </div>
          <div className="relative z-10">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Total Inventory</h3>
            <p className="text-xs text-slate-500 uppercase font-bold mt-1 tracking-widest">Available Items</p>
          </div>
        </Link>

        <Link href="/admin/restock" className="bg-slate-900 border border-white/10 p-6 rounded-3xl flex flex-col gap-6 hover:border-emerald-500/50 transition-all group relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
          <div className="flex justify-between items-start relative z-10">
            <div className="bg-emerald-500/20 p-4 rounded-2xl text-emerald-400 group-hover:scale-110 transition-all"><Archive size={28} /></div>
            <ArrowRight className="text-slate-600 group-hover:text-emerald-400 transition-colors mt-2" size={24} />
          </div>
          <div className="relative z-10">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Restock Mgmt</h3>
            <p className="text-[10px] text-emerald-400 uppercase font-black mt-1 tracking-widest bg-emerald-500/10 inline-block px-2 py-1 rounded-md">
              Last: {stats.lastRestockDate}
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
