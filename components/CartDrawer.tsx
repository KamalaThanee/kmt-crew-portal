"use client";
import { useState, useEffect, useCallback, useMemo } from 'react';
import { ShoppingCart, X, Trash2, PackageCheck, Save, Users, ShieldAlert, AlertTriangle } from 'lucide-react';
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    const u = JSON.parse(localStorage.getItem('kmt_user') || 'null');
    setUser(u);
    setCartItems(JSON.parse(localStorage.getItem('kmt_cart') || '[]'));
    if (u && ["safety officer", "chief officer", "barge master"].includes(u.position.toLowerCase())) {
      const { data } = await supabase.from('crews').select('*').order('full_name');
      if (data) setCrews(data);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('open-cart', () => { loadData(); setIsOpen(true); });
    window.addEventListener('cart-updated', loadData);
    return () => window.removeEventListener('cart-updated', loadData);
  }, [loadData]);

  // 🎯 เช็คว่าต้องกรอกเหตุผลหรือไม่ (ถ้าเบิกแทน หรือ มีรายการผิดกฎ)
  const isReasonMandatory = useMemo(() => {
    if (onBehalf && targetCrewId && targetCrewId !== user?.id) return true;
    // (สามารถเพิ่มเงื่อนไขเช็คโควตาจริงจังที่นี่ได้ถ้าต้องการ)
    return false;
  }, [onBehalf, targetCrewId, user]);

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    if (isReasonMandatory && !reason.trim()) return toast.error("โปรดกรอกเหตุผลในการเบิกกรณีพิเศษ");
    
    setIsSubmitting(true);
    try {
      const selectedCrew = onBehalf ? crews.find(c => c.id === targetCrewId) : user;
      const isDirectIssue = onBehalf && selectedCrew.id !== user.id;

      // 1. บันทึกคำขอ
      const { error: reqError } = await supabase.from('ppe_requests').insert({
        crew_id: selectedCrew.id,
        crew_name: selectedCrew.full_name,
        items: cartItems,
        reason: reason.trim() || 'Standard Request',
        status: isDirectIssue ? 'received' : 'pending'
      });

      if (reqError) throw reqError;

      // 🎯 2. ถ้าเป็น Direct Issue ให้ตัดสต๊อกทันที!
      if (isDirectIssue) {
        for (const item of cartItems) {
          const { data: inv } = await supabase.from('ppe_inventory').select('quantity').eq('id', item.id).single();
          if (inv) await supabase.from('ppe_inventory').update({ quantity: Math.max(0, inv.quantity - 1) }).eq('id', item.id);
        }
      }

      localStorage.setItem('kmt_cart', '[]');
      setReason(""); setOnBehalf(false);
      window.dispatchEvent(new CustomEvent('cart-updated', { detail: 0 }));
      setIsOpen(false);
      toast.success(isDirectIssue ? "Direct Issue Successful (Stock deducted)" : "Request submitted for approval");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex justify-end">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
      <div className="relative w-full max-w-sm bg-zinc-950 h-full shadow-2xl border-l border-orange-500/20 flex flex-col animate-in slide-in-from-right duration-300">
        
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3 text-orange-500"><ShoppingCart size={24}/><h2 className="text-xl font-black uppercase italic italic">Confirm PPE</h2></div>
          <button onClick={() => setIsOpen(false)} className="p-2 text-zinc-500 hover:text-white"><X size={20}/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
          {/* Section: Items */}
          <div className="space-y-3">
             {cartItems.map((item, idx) => (
                <div key={idx} className="bg-white/5 p-4 rounded-3xl border border-white/5 flex justify-between items-center group">
                   <div><p className="text-white font-bold text-sm uppercase">{item.item_name}</p><p className="text-[10px] text-orange-500 font-black mt-1 uppercase">{item.color} | {item.size}</p></div>
                   <button onClick={() => { const n = [...cartItems]; n.splice(idx, 1); localStorage.setItem('kmt_cart', JSON.stringify(n)); window.dispatchEvent(new CustomEvent('cart-updated')); }} className="text-zinc-600 hover:text-red-500 p-2"><Trash2 size={18}/></button>
                </div>
             ))}
          </div>

          {/* Section: Admin On-Behalf (Only for Admins) */}
          {user && ["safety officer", "chief officer", "barge master"].includes(user.position.toLowerCase()) && (
             <div className="p-5 bg-zinc-900 border border-orange-500/20 rounded-[32px] space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2 text-orange-500 font-black text-[10px] uppercase tracking-widest"><Users size={14}/> Request for other?</div>
                   <input type="checkbox" checked={onBehalf} onChange={(e) => setOnBehalf(e.target.checked)} className="w-5 h-5 accent-orange-500" />
                </div>
                {onBehalf && (
                   <div className="animate-in slide-in-from-top-2">
                      <select value={targetCrewId} onChange={(e) => setTargetCrewId(e.target.value)} className="w-full bg-black border border-white/10 p-4 rounded-xl text-white text-xs font-bold outline-none focus:border-orange-500">
                         <option value="">-- Select Crew Member --</option>
                         {crews.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                      </select>
                      <div className="mt-3 flex items-center gap-2 text-[9px] text-zinc-500 font-bold uppercase"><ShieldAlert size={12}/> Will be processed as Direct Issue</div>
                   </div>
                )}
             </div>
          )}

          {/* Section: Reason */}
          <div className="space-y-2 pt-4">
             <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                Reason for Request {isReasonMandatory && <span className="text-red-500">* Required</span>}
             </label>
             <textarea rows={3} placeholder="Describe why this PPE is needed..." value={reason} onChange={(e) => setReason(e.target.value)} className={`w-full bg-black/50 border ${isReasonMandatory && !reason.trim() ? 'border-red-500/50' : 'border-white/10'} rounded-2xl p-4 text-sm text-white outline-none focus:border-orange-500 transition-all resize-none`} />
          </div>
        </div>

        <div className="p-6 bg-black/40 border-t border-white/5">
          <button onClick={handleCheckout} disabled={cartItems.length === 0 || isSubmitting} className="w-full py-5 bg-orange-600 hover:bg-orange-500 text-white rounded-3xl font-black uppercase text-xs shadow-xl active:scale-95 flex items-center justify-center gap-3 disabled:opacity-30">
            {isSubmitting ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}
            {onBehalf ? 'Complete Direct Issue' : 'Submit for Approval'}
          </button>
        </div>
      </div>
    </div>
  );
}
