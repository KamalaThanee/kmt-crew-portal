"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Upload, Package, ChevronRight, FileText, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function RestockPage() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    const { data } = await supabase.from("ppe_inventory").select("*");
    if (data) setInventory(data);
  };

  const handleRestock = async (item: any) => {
    if (amount <= 0) return alert("กรุณาใส่จำนวน");
    setLoading(true);
    let receiptUrl = "";

    if (file) {
      const fileName = `${Date.now()}-${file.name}`;
      const { data: uploadData } = await supabase.storage.from('receipts').upload(fileName, file);
      if (uploadData) {
        const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(fileName);
        receiptUrl = urlData.publicUrl;
      }
    }

    const { error } = await supabase.from('ppe_inventory').update({ quantity: item.quantity + amount }).eq('id', item.id);
    if (!error) {
      await supabase.from('restock_history').insert({
        item_id: item.id,
        item_name: item.item_name,
        quantity_added: amount,
        receipt_url: receiptUrl,
        added_by: JSON.parse(localStorage.getItem("crew_session") || "{}").name
      });
      alert("Restock Success!");
      setAmount(0);
      setFile(null);
      fetchInventory();
    }
    setLoading(false);
  };

  const categories = Array.from(new Set(inventory.map(i => i.item_name.split(" ")[0])));
  const items = inventory.filter(i => i.item_name.startsWith(selectedCat || ""));
  const variants = inventory.filter(i => i.item_name === selectedItem);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10 flex justify-between items-center">
            <Link href="/admin/dashboard" className="flex items-center gap-2 text-zinc-500 hover:text-white transition"><ArrowLeft size={18}/> Back to Dashboard</Link>
            <h1 className="text-2xl font-black">RESTOCK <span className="text-emerald-500">ENTRY</span></h1>
        </header>

        <section className="bg-zinc-900 p-8 rounded-[2rem] border border-zinc-800 mb-8">
            <p className="text-xs font-black text-emerald-500 uppercase mb-4">Step 1: Upload Invoice/Receipt</p>
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-zinc-800 file:text-white hover:file:bg-zinc-700"/>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
                <div>
                    <p className="text-zinc-600 text-[10px] font-black uppercase mb-3">01. Select Category</p>
                    <div className="grid grid-cols-2 gap-2">
                        {categories.map(cat => (
                            <button key={cat} onClick={() => setSelectedCat(cat)} className={`p-4 rounded-2xl border-2 font-bold text-left transition ${selectedCat === cat ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-900 text-zinc-500'}`}>{cat}</button>
                        ))}
                    </div>
                </div>
                {selectedCat && (
                    <div>
                        <p className="text-zinc-600 text-[10px] font-black uppercase mb-3">02. Select Item</p>
                        <div className="space-y-2">
                            {Array.from(new Set(items.map(i => i.item_name))).map(item => (
                                <button key={item} onClick={() => setSelectedItem(item)} className={`w-full p-4 rounded-xl flex justify-between items-center transition ${selectedItem === item ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-500 border border-zinc-800'}`}>{item} <ChevronRight size={16}/></button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div>
                {selectedItem && (
                    <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 sticky top-12">
                        <p className="text-zinc-600 text-[10px] font-black uppercase mb-4">03. Add Quantity</p>
                        <div className="space-y-4">
                            {variants.map(v => (
                                <div key={v.id} className="p-4 bg-zinc-800 rounded-2xl flex items-center justify-between gap-4">
                                    <div className="text-xs font-bold">{v.size} <span className="text-zinc-500">({v.quantity})</span></div>
                                    <div className="flex items-center gap-2">
                                        <input type="number" placeholder="Qty" className="w-16 bg-black border border-zinc-700 rounded-lg p-1 text-center text-sm" onChange={(e) => setAmount(parseInt(e.target.value))}/>
                                        <button onClick={() => handleRestock(v)} disabled={loading} className="bg-emerald-600 p-2 rounded-lg hover:bg-emerald-500 transition"><Upload size={16}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
