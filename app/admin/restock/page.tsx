"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PackagePlus, Search, RefreshCw } from "lucide-react";

export default function RestockPage() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [addAmounts, setAddAmounts] = useState<Record<string, number>>({});

  const fetchInventory = async () => {
    const { data } = await supabase.from("ppe_inventory").select("*").order("item_name");
    if (data) setInventory(data);
  };
  useEffect(() => { fetchInventory(); }, []);

  const handleAddStock = async (id: string, currentQty: number) => {
    const amountToAdd = addAmounts[id] || 0;
    if (amountToAdd <= 0) return;
    const { error } = await supabase.from("ppe_inventory").update({ quantity: currentQty + amountToAdd }).eq("id", id);
    if (!error) { setAddAmounts({ ...addAmounts, [id]: 0 }); fetchInventory(); alert("Stock Updated!"); }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto min-h-screen bg-white">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3"><PackagePlus className="text-emerald-500" size={32} /> Restock PPE</h1>
        <div className="relative w-64">
          <Search className="absolute left-3 top-3 text-slate-400" size={18} />
          <input type="text" placeholder="Search items..." className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-full focus:ring-2 focus:ring-emerald-500 focus:outline-none" onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {inventory.filter(i => i.item_name.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (
          <div key={item.id} className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50 flex justify-between items-center hover:border-emerald-200 transition">
            <div>
              <h3 className="font-bold text-slate-800">{item.item_name}</h3>
              <p className="text-sm text-slate-500">Size: {item.size} | Color: {item.color}</p>
              <p className="mt-2 text-xs font-bold px-2 py-1 bg-white rounded-md border inline-block">Stock: <span className={item.quantity <= 5 ? 'text-rose-600' : 'text-blue-600'}>{item.quantity}</span></p>
            </div>
            <div className="flex items-center gap-2">
              <input type="number" className="w-16 p-2 rounded-lg border border-slate-200 text-center font-bold" value={addAmounts[item.id] || ""} onChange={(e) => setAddAmounts({...addAmounts, [item.id]: parseInt(e.target.value) || 0})} placeholder="0" />
              <button onClick={() => handleAddStock(item.id, item.quantity)} className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-md transition"><RefreshCw size={20}/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
