"use client";
import { useState, useEffect, useCallback, useMemo } from 'react';
import { ShoppingCart, X, Trash2, PackageCheck, Save, Users, ShieldAlert, AlertTriangle, Loader2, Lock, History } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

export default function CartDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [reason, setReason] = useState("");
  const [onBehalf, setOnBehalf] = useState(false);
  const [targetCrewId, setTargetCrewId] = useState("");
  const [crews, setCrews] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [targetHistory, setTargetHistory] = useState<any[]>([]); // 🎯 เก็บประวัติคนที่เราจะเบิกให้
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    const uStr = localStorage.getItem('kmt_user');
    if (!uStr) return;
    const u = JSON.parse(uStr);
    setUser(u);
    setCartItems(JSON.parse(localStorage.getItem('kmt_cart') || '[]'));

    if (["safety officer", "chief officer", "barge master"].includes(u.position.toLowerCase())) {
      const { data } = await supabase.from('crews').select('*').order('full_name');
      if (data) setCrews(data);
    }
  }, []);

  // 🎯 ดึงประวัติการเบิกของพนักงานเป้าหมาย
  useEffect(() => {
    const fetchHistory = async () => {
      if (!onBehalf || !targetCrewId) { setTargetHistory([]); return; }
      const { data } = await supabase.from('ppe_requests').select('created_at, items').eq('crew_id', targetCrewId).neq('status', 'rejected').order('created_at', { ascending: false });
      if (data) setTargetHistory(data);
    };
    fetchHistory();
  }, [onBehalf, targetCrewId]);

  useEffect(() => {
    window.addEventListener('open-cart', () => { loadData(); setIsOpen(true); });
    window.addEventListener('cart-updated', () => {
      setCartItems(JSON.parse(localStorage.getItem('kmt_cart') || '[]'));
    });
    return () => { window.removeEventListener('cart-updated', loadData); };
  }, [loadData]);

  // ฟังก์ชันคำนวณว่าพนักงานคนนี้เคยเบิกของชิ้นนี้ไปเท่าไร
  const getItemStats = (itemName: string) => {
    let count = 0; let lastDate = "Never";
    targetHistory.forEach(req => {
       const found = req.items?.find((i:any) => i.item_name === itemName);
       if (found) {
          count++;
          if (lastDate === "Never") lastDate = new Date(req.created_at).toLocaleDateString('en-GB');
       }
    });
    return { count, lastDate };
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    if (onBehalf && !targetCrewId) return toast.error("โปรดเลือกพนักงาน");
    
    setIsSubmitting(true);
    try {
      const selectedCrew = onBehalf ? crews.find(c => c.id === targetCrewId) : user;
      const isDirect = onBehalf && selectedCrew.id !== user.id;

      const { error } = await supabase.from('ppe_requests').insert({
        crew_id: selectedCrew.id, crew_name: selectedCrew.full_name, items: cartItems, reason: reason.trim() || 'Standard Request', status: isDirect ? 'received' : 'pending'
      });

      if (error) throw error;
      if (isDirect) {
        for (const item of cartItems) {
          const { data: inv } = await supabase.from('ppe_inventory').select('quantity').eq('id', item.id).single();
          if (inv) await supabase.from('ppe_inventory').update({ quantity: Math.max(0, inv.quantity - 1) }).eq('id', item.id);
        }
      }

      localStorage.setItem('kmt_cart', '[]');
      setReason(""); setOnBehalf(false); setIsOpen(false);
      window.dispatchEvent(new CustomEvent('cart-updated', { detail: 0 }));
      toast.success(isDirect ? "Direct Issue Completed" : "Request Submitted");
    } catch (e: any) { toast.error(e.message); } finally { setIsSubmitting(false); }
  };

  const StatusIcon = isSubmitting ? Loader2 : (onBehalf ? ShieldAlert : Save);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex justify-end">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
      <div className="relative w-full max-w-sm bg-zinc-950 h-full shadow-2xl border-l border-orange-500/20 flex flex-col animate-in slide-in-from-right duration-300">
        <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 text-orange-500"><ShoppingCart size={24}/><h2 className="text-xl font-black uppercase italic italic">Cart Review</h2></div>
          <button onClick={() => setIsOpen(false)} className="p-2 text-zinc-500 hover:text-white transition-colors"><X size={20}/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
          {/* Section: Admin On-Behalf */}
          {user && ["safety officer", "chief officer", "barge master"].includes(user.position.toLowerCase()) && (
             <div className="p-5 bg-zinc-900 border border-orange-500/20 rounded-[32px] space-y-4 shadow-xl mb-4">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2 text-orange-500 font-black text-[10px] uppercase tracking-widest"><Users size={16}/> Direct Issue Mode</div>
                   <input type="checkbox" checked={onBehalf} onChange={(e) => setOnBehalf(e.target.checked)} className="w-6 h-6 accent-orange-500 rounded-lg cursor-pointer" />
                </div>
                {onBehalf && (
                   <div className="animate-in slide-in-from-top-2">
                      <select value={targetCrewId} onChange={(e) => setTargetCrewId(e.target.value)} className="w-full bg-black border border-white/10 p-4 rounded-xl text-white text-xs font-bold outline-none focus:border-orange-500 uppercase">
                         <option value="">-- Select Member --</option>
                         {crews.filter(c => c.id !== user.id).map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                      </select>
                   </div>
                )}
             </div>
          )}

          {/* Section: Items with Contextual History */}
          <div className="space-y-4">
             {cartItems.map((item, idx) => {
                const stats = onBehalf && targetCrewId ? getItemStats(item.item_name) : null;
                return (
                  <div key={idx} className="bg-zinc-900 border border-white/5 p-4 rounded-[28px] space-y-3 shadow-md">
                     <div className="flex justify-between items-start">
                        <div><p className="text-white font-black text-xs uppercase leading-tight">{item.item_name}</p><p className="text-[9px] text-orange-500 font-bold mt-1 uppercase">{item.color} | {item.size}</p></div>
                        <button onClick={() => { const n = [...cartItems]; n.splice(idx, 1); localStorage.setItem('kmt_cart', JSON.stringify(n)); window.dispatchEvent(new CustomEvent('cart-updated')); }} className="text-zinc-700 hover:text-red-500 transition-colors p-1"><Trash2 size={16}/></button>
                     </div>
                     {/* 🎯 แสดงประวัติถ้าเป็นโหมดเบิกแทน */}
                     {stats && (
                        <div className="bg-black/40 p-3 rounded-xl border border-white/5 flex items-center gap-3">
                           <History size={14} className="text-zinc-600"/>
                           <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Issued: <span className="text-white">{stats.count} Times</span> | Last: <span className="text-white">{stats.lastDate}</span></p>
                        </div>
                     )}
                  </div>
                )
             })}
             {cartItems.length === 0 && <div className="text-center py-20 text-zinc-700 font-black uppercase text-[10px] tracking-widest"><PackageCheck size={48} className="mx-auto mb-4 opacity-10"/><p>Cart Empty</p></div>}
          </div>

          <div className="space-y-3 pt-4">
             <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Request Reason</label>
             <textarea rows={3} placeholder="Provide a brief reason..." value={reason} onChange={(e) => setReason(e.target.value)} className="w-full bg-black border border-white/5 rounded-2xl p-4 text-sm text-white outline-none focus:border-orange-500 transition-all resize-none" />
          </div>
        </div>

        <div className="p-6 bg-black/40 border-t border-white/5 shrink-0">
          <button onClick={handleCheckout} disabled={cartItems.length === 0 || isSubmitting} className="w-full py-5 rounded-3xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 bg-orange-600 hover:bg-orange-500 text-white shadow-orange-600/20 disabled:opacity-30">
            <StatusIcon size={18} className={isSubmitting ? "animate-spin" : ""} />
            {onBehalf ? 'Complete Direct Issue' : 'Submit for Approval'}
          </button>
        </div>
      </div>
    </div>
  );
}
