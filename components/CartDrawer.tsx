"use client";
import { useState, useEffect, useCallback, useMemo } from 'react';
import { ShoppingCart, X, Trash2, PackageCheck, Save, Users, ShieldAlert, AlertTriangle, Loader2, Lock } from 'lucide-react';
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
  const [quotas, setQuotas] = useState({ suit: 0, boot: 0 });
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

    const { data: reqs } = await supabase.from('ppe_requests')
      .select('items')
      .eq('crew_id', u.id)
      .neq('status', 'rejected')
      .gte('created_at', `${new Date().getFullYear()}-01-01`);
    
    let sc = 0; let bc = 0;
    reqs?.forEach(r => r.items?.forEach((i:any) => {
      if (i.item_name.toLowerCase().includes('suit')) sc++;
      if (i.item_name.toLowerCase().includes('safety boot') && !i.item_name.toLowerCase().includes('rubber')) bc++;
    }));
    setQuotas({ suit: sc, boot: bc });
  }, []);

  useEffect(() => {
    window.addEventListener('open-cart', () => { loadData(); setIsOpen(true); });
    window.addEventListener('cart-updated', () => {
      setCartItems(JSON.parse(localStorage.getItem('kmt_cart') || '[]'));
    });
    return () => { window.removeEventListener('cart-updated', loadData); };
  }, [loadData]);

  const personalViolation = useMemo(() => {
    if (onBehalf) return null;
    let violation = "";
    let suitInCart = 0; let bootInCart = 0;
    for (const item of cartItems) {
      const name = item.item_name.toLowerCase();
      if (name.includes('suit')) {
        suitInCart++;
        if (item.size !== user?.suit_size || item.color !== user?.suit_color) violation = "ผิดไซส์หรือสีประจำตัว";
      }
      if (name.includes('safety boot') && !name.includes('rubber')) {
        bootInCart++;
        if (item.size !== user?.boot_size) violation = "ผิดไซส์รองเท้าประจำตัว";
      }
    }
    if (quotas.suit + suitInCart > 2) violation = "เกินโควตาชุดประจำปี (2/ปี)";
    if (quotas.boot + bootInCart > 1) violation = "เกินโควตารองเท้าประจำปี (1/ปี)";
    return violation;
  }, [cartItems, onBehalf, user, quotas]);

  const handleCheckout = async () => {
    if (cartItems.length === 0 || personalViolation) return;
    if (onBehalf && !targetCrewId) return toast.error("โปรดเลือกพนักงาน");
    if (onBehalf && targetCrewId !== user?.id && !reason.trim()) return toast.error("โปรดระบุเหตุผลการเบิกแทน");
    
    setIsSubmitting(true);
    try {
      const selectedCrew = onBehalf ? crews.find(c => c.id === targetCrewId) : user;
      const isDirect = onBehalf && selectedCrew.id !== user.id;

      const { error } = await supabase.from('ppe_requests').insert({
        crew_id: selectedCrew.id,
        crew_name: selectedCrew.full_name,
        items: cartItems,
        reason: reason.trim() || 'Standard Request',
        status: isDirect ? 'received' : 'pending'
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
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 🎯 แยกตัวแปร Icon เพื่อเลี่ยงปัญหา JSX Attribute ของ TypeScript
  const StatusIcon = isSubmitting ? Loader2 : (personalViolation ? Lock : (onBehalf ? ShieldAlert : Save));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex justify-end">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
      <div className="relative w-full max-w-sm bg-zinc-950 h-full shadow-2xl border-l border-orange-500/20 flex flex-col animate-in slide-in-from-right duration-300">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3 text-orange-500"><ShoppingCart size={24}/><h2 className="text-xl font-black uppercase italic tracking-tighter">Checkout</h2></div>
          <button onClick={() => setIsOpen(false)} className="p-2 text-zinc-500 hover:text-white"><X size={20}/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
          <div className="space-y-3">
             {cartItems.map((item, idx) => (
                <div key={idx} className="bg-zinc-900 border border-white/5 p-4 rounded-3xl flex justify-between items-center group shadow-md">
                   <div><p className="text-white font-black text-xs uppercase leading-tight">{item.item_name}</p><p className="text-[10px] text-orange-500 font-bold mt-1 uppercase">{item.color} | {item.size}</p></div>
                   <button onClick={() => { const n = [...cartItems]; n.splice(idx, 1); localStorage.setItem('kmt_cart', JSON.stringify(n)); window.dispatchEvent(new CustomEvent('cart-updated')); }} className="text-zinc-700 hover:text-red-500 p-2"><Trash2 size={18}/></button>
                </div>
             ))}
             {cartItems.length === 0 && <div className="text-center py-20 text-zinc-700 font-black uppercase text-[10px] tracking-widest"><PackageCheck size={48} className="mx-auto mb-4 opacity-10"/><p>Cart Empty</p></div>}
          </div>

          {user && ["safety officer", "chief officer", "barge master"].includes(user.position.toLowerCase()) && (
             <div className="p-6 bg-orange-600/5 border border-orange-500/20 rounded-[32px] space-y-4">
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

          <div className="space-y-3">
             <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Order Remark</label>
             <textarea rows={3} placeholder="Provide a reason..." value={reason} onChange={(e) => setReason(e.target.value)} className="w-full bg-black border border-white/5 rounded-2xl p-4 text-sm text-white outline-none focus:border-orange-500 transition-all resize-none" />
          </div>

          {personalViolation && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex gap-3 animate-pulse">
               <AlertTriangle className="text-red-500 shrink-0" size={20}/>
               <p className="text-[9px] text-red-500 font-black uppercase leading-tight">{personalViolation}. <br/><span className="text-white mt-1 block italic opacity-70">Use "Direct Issue" mode for others.</span></p>
            </div>
          )}
        </div>

        <div className="p-6 bg-black/40 border-t border-white/5">
          <button 
            onClick={handleCheckout} 
            disabled={cartItems.length === 0 || isSubmitting || (!!personalViolation)} 
            className={`w-full py-5 rounded-3xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 ${personalViolation ? 'bg-zinc-800 text-zinc-600' : 'bg-orange-600 hover:bg-orange-500 text-white'}`}
          >
            <StatusIcon size={18} className={isSubmitting ? "animate-spin" : ""} />
            {personalViolation ? 'Rules Violation' : onBehalf ? 'Complete Direct Issue' : 'Submit for Approval'}
          </button>
        </div>
      </div>
    </div>
  );
}
