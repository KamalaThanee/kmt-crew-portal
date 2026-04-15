"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Package, Check } from "lucide-react";

export default function CrewHistoryPage() {
  const [history, setHistory] = useState<any[]>([]);
  const crewId = "CREW_001"; // จำลองค่า ID

  const fetchHistory = async () => {
    const { data } = await supabase.from("ppe_requests").select("*").eq("crew_id", crewId).order("request_date", { ascending: false });
    if (data) setHistory(data);
  };

  useEffect(() => { fetchHistory(); }, []);

  const handleMarkReceived = async (req: any) => {
    const { error } = await supabase.from("ppe_requests").update({ status: "Received" }).eq("id", req.id);
    if (!error) {
      const { data: inv } = await supabase.from("ppe_inventory").select("id, quantity").eq("item_name", req.item_name).eq("size", req.size).eq("color", req.color).single();
      if (inv) await supabase.from("ppe_inventory").update({ quantity: inv.quantity - 1 }).eq("id", inv.id);
      fetchHistory();
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2"><Package /> My History</h1>
      <div className="space-y-4">
        {history.map((item) => (
          <div key={item.id} className="bg-white p-4 rounded-lg shadow border-l-4 border-indigo-500 flex justify-between items-center">
            <div><h3 className="font-bold">{item.item_name}</h3><p className="text-sm text-gray-500">{item.status}</p></div>
            {item.status === "Approved" && (
              <button onClick={() => handleMarkReceived(item)} className="bg-green-600 text-white px-3 py-1 rounded flex items-center gap-1 text-sm"><Check size={14}/> Received</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
