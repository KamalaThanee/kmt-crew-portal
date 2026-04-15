"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { AlertTriangle, TrendingUp, Download } from "lucide-react";

export default function AdminDashboard() {
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalReqs: 0 });

  useEffect(() => {
    const fetchData = async () => {
      const { data: stock } = await supabase.from("ppe_inventory").select("*");
      if (stock) setLowStock(stock.filter(i => i.quantity <= (i.threshold || 5)));
      const { data: reqs } = await supabase.from("ppe_requests").select("*");
      if (reqs) setStats({ totalReqs: reqs.length });
    };
    fetchData();
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-lg shadow flex items-center gap-4">
          <TrendingUp className="text-indigo-600" />
          <div><p className="text-sm text-gray-500">Total Requests</p><h2 className="text-2xl font-bold">{stats.totalReqs}</h2></div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow flex items-center gap-4 text-red-600">
          <AlertTriangle />
          <div><p className="text-sm text-gray-500">Low Stock Items</p><h2 className="text-2xl font-bold">{lowStock.length}</h2></div>
        </div>
      </div>
    </div>
  );
}
