"use client";
import { useState, useEffect, useCallback, useMemo } from 'react';
import { ShoppingCart, X, Trash2, PackageCheck, Save, Users, ShieldAlert, AlertTriangle, Loader2, Lock, History as HistoryIcon } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

const normalize = (str: string) => String(str || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();

export default function CartDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [reason, setReason] = useState("");
  const [onBehalf, setOnBehalf] = useState(false);
  const [targetCrewId, setTargetCrewId] = useState("");
  const [crews, setCrews] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [targetHistory, setTargetHistory] = useState<any[]>([]); // ประวัติของคนที่ถูกเลือกเบิกแทน
  const [personalQuotas, setPersonalQuotas] = useState({ suit: 0, boot: 0 });
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

    // โหลดโควตาของแอดมินเอง
    const { data: reqs } = await supabase.from('ppe_requests').select('items').eq('crew_id', u.id).neq('status', 'rejected').gte('created_at', `${new Date().getFullYear()}-01-01`);
    let sc = 0; let bc = 0;
    reqs?.forEach(r => r.items?.forEach((i:any) => {
      if (i.item_name.toLowerCase().includes('suit')) sc++;
      if (i.item_name.toLowerCase().includes('safety boot') && !i.item_name.toLowerCase().includes('rubber')) bc++;
    }));
    setPersonalQuotas({ suit: sc, boot: bc });
  }, []);

  // 🎯 ดึงประวัติพนักงานเมื่อมีการเลือกชื่อ
  useEffect(() => {
    const fetchTargetHistory = async () => {
      if (!onBehalf || !targetCrewId) { setTargetHistory([]); return; }
      const { data } = await supabase.from('ppe_requests').select('created_at, items').eq('crew_id', targetCrewId).neq('status', 'rejected').order('created_at', { ascending: false });
      if (data) setTargetHistory(data);
    };
    fetchTargetHistory();
  }, [onBehalf, targetCrewId]);

  useEffect(() => {
    window.addEventListener('open-cart', () => { loadData(); setIsOpen(true); });
    window.addEventListener('cart-updated', () => setCartItems(JSON.parse(localStorage.getItem('kmt_cart') || '[]')));
    return () => { window.removeEventListener('cart-updated', loadData); };
  }, [loadData]);

  // 🎯 กฎตรวจสอบพฤติกรรมแอดมิน (Personal Rules Enforcement)
  const personalViolation = useMemo(() => {
    if (onBehalf) return null; // ถ้าเบิกให้คนอื่น กฎนี้จะไม่ถูกนำมาใช้
    
    let violation = "";
    let suitInCart = 0; let bootInCart = 0;

    for (const item of cartItems) {
      const name = item.item_name.toLowerCase();
      const isSuit = name.includes('suit');
      const isBoot = name.includes('safety boot') && !name.includes('rubber');

      if (isSuit) {
        suitInCart++;
        if (item.size !== user?.suit_size || item.color !== user?.suit_color) violation = "ผิดไซส์หรือสีประจำตัว (Personal Size Mismatch)";
      }
      if (isBoot) {
        bootInCart++;
        if (item.size !== user?.boot_size) violation = "ผิดไซส์รองเท้าประจำตัว (Personal Boot Size Mismatch)";
      }
    }
    if (personalQuotas.suit + suitInCart > 2) violation = "คุณเบิกชุด Boiler Suit เกินโควตาส่วนตัวประจำปี";
    if (personalQuotas.boot + bootInCart > 1) violation = "คุณเบิก Safety Boots เกินโควตาส่วนตัวประจำปี";

    return violation;
  }, [cartItems, onBehalf, user, personalQuotas]);

  // 🎯 ฟังก์ชันช่วยดูว่าพนักงานเป้าหมายเคยเบิกของชิ้นนี้ไปหรือยัง
  const getTargetItemStats = (itemName: string) => {
    let count = 0; let lastDate = "Never";
    targetHistory.forEach(req => {
       const found = req.items?.find((i:any) => normalize(i.item_name) === normalize(itemName));
       if (found) {
          count++;
          if (lastDate === "Never") lastDate = new Date(req.created_at).toLocaleDateString('en-GB');
       }
    });
    return { count, lastDate };
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0 || personalViolation) return;
    if (onBehalf && !targetCrewId) return toast.error("โปรดเลือกพนักงานที่ต้องการเบิกแทน");
    if (onBehalf && !reason.trim()) return toast.error("โปรดระบุเหตุผลในการเบิกแทนพนักงาน (Mandatory)");
    
    setIsSubmitting(true);
    try {
      const selectedCrew = onBehalf ? crews.find(c => c.id === targetCrewId) : user;
      const isDirect = onBehalf && selectedCrew.id !== user.id;

      const { error } = await supabase.from('ppe_requests').insert({
        crew_id: selectedCrew.id, crew_name: selectedCrew.full_name, items: cartItems, 
        reason: reason.trim() || 'Standard Request', status: isDirect ? 'received' : 'pending'
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
      toast.success(isDirect ? "Direct Issue Success: Stock Updated" : "Request Submitted");
    } catch (e: any) { toast.error(e.message); } finally { setIsSubmitting(false); }
  };

  const StatusIcon = isSubmitting ? Loader2 : (personalViolation ? Lock : (onBehalf ? ShieldAlert : Save));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex justify-end">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
      <div className="relative w-full max-w-sm bg-zinc-950 h-full shadow-2xl border-l border-orange-500/20 flex flex-col animate-in slide-in-from-right duration-300">
        <div className="p-6 border-b border-white/5 flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-3 text-orange-500"><ShoppingCart size={24}/><h2 className="text-xl font-black uppercase italic italic tracking-tighter text-white">Cart Check</h2></div>
          <button onClick={() => setIsOpen(false)} className="p-2 bg-white/5 rounded-full text-zinc-500 hover:text-white transition-colors"><X size={20}/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
          {/* Section: Mode Toggle */}
          {user && ["safety officer", "chief officer", "barge master"].includes(user.position.toLowerCase()) && (
             <div className={`p-5 rounded-[32px] border transition-all ${onBehalf ? 'bg-orange-500 border-orange-400' : 'bg-zinc-900 border-white/5 shadow-xl'}`}>
                <div className="flex items-center justify-between">
                   <div className={`flex items-center gap-2 font-black text-[10px] uppercase tracking-widest ${onBehalf ? 'text-black' : 'text-orange-500'}`}><Users size={16}/> Direct Issue Mode</div>
                   <input type="checkbox" checked={onBehalf} onChange={(e) => setOnBehalf(e.target.checked)} className="w-6 h-6 accent-black rounded-lg cursor-pointer" />
                </div>
                {onBehalf && (
                   <div className="animate-in slide-in-from-top-2 mt-4 space-y-3">
                      <select value={targetCrewId} onChange={(e) => setTargetCrewId(e.target.value)} className="w-full bg-black/50 border border-white/20 p-4 rounded-xl text-white text-xs font-bold outline-none focus:border-white">
                         <option value="">-- Choose Member --</option>
                         {crews.filter(c => c.id !== user.id).map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                      </select>
                      <p className="text-[8px] text-black font-black uppercase tracking-tighter flex items-center gap-1"><AlertTriangle size={10}/> This action bypasses user quotas and deducts stock instantly.</p>
                   </div>
                )}
             </div>
          )}

          {/* Section: Items with Contextual History */}
          <div className="space-y-4">
             {cartItems.map((item, idx) => {
                const targetStats = (onBehalf && targetCrewId) ? getTargetItemStats(item.item_name) : null;
                return (
                  <div key={idx} className="bg-zinc-900 border border-white/5 p-4 rounded-[28px] space-y-3 shadow-md">
                     <div className="flex justify-between items-start">
                        <div><p className="text-white font-black text-sm uppercase leading-tight">{item.item_name}</p><p className="text-[10px] text-orange-500 font-bold mt-1 uppercase">{item.color} | Size: {item.size}</p></div>
                        <button onClick={() => { const n = [...cartItems]; n.splice(idx, 1); localStorage.setItem('kmt_cart', JSON.stringify(n)); window.dispatchEvent(new CustomEvent('cart-updated')); }} className="text-zinc-700 hover:text-red-500 p-1"><Trash2 size={16}/></button>
                     </div>
                     {/* 🎯 Contextual History Display */}
                     {targetStats && (
                        <div className="bg-black/50 p-3 rounded-xl border border-white/5 flex items-center gap-3">
                           <HistoryIcon size={14} className="text-zinc-600"/>
                           <div>
                             <p className="text-[8px] text-zinc-500 font-black uppercase tracking-tighter">Personnel History:</p>
                             <p className="text-[9px] text-white font-bold uppercase tracking-widest">{targetStats.count} Total Issued <span className="text-zinc-500 ml-2">Last: {targetStats.lastDate}</span></p>
                           </div>
                        </div>
                     )}
                  </div>
                )
             })}
             {cartItems.length === 0 && <div className="text-center py-20 text-zinc-800 font-black uppercase text-xs tracking-widest italic opacity-20"><PackageCheck size={48} className="mx-auto mb-4"/><p>Select items first</p></div>}
          </div>

          <div className="space-y-3 pt-4">
             <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Direct Issue Reason</label>
             <textarea rows={3} placeholder={onBehalf ? "Mandatory: Why is this needed?" : "Optional reason..."} value={reason} onChange={(e) => setReason(e.target.value)} className={`w-full bg-black border ${onBehalf && !reason.trim() ? 'border-red-500/50 animate-pulse' : 'border-white/5'} rounded-2xl p-4 text-sm text-white outline-none focus:border-orange-500 transition-all resize-none`} />
          </div>

          {personalViolation && (
            <div className="p-4 bg-red-600 border border-red-400 rounded-2xl flex gap-3 shadow-lg shadow-red-600/20">
               <XCircle className="text-white shrink-0" size={20}/>
               <p className="text-[9px] text-white font-black uppercase leading-tight">{personalViolation}. <br/><span className="text-black/80 mt-1 block">Switch to "Direct Issue" mode if providing for others.</span></p>
            </div>
          )}
        </div>

        <div className="p-6 bg-black/40 border-t border-white/5 shrink-0">
          <button 
            onClick={handleCheckout} 
            disabled={cartItems.length === 0 || isSubmitting || (!!personalViolation)} 
            className={`w-full py-5 rounded-3xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 ${personalViolation ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-500 text-white shadow-orange-600/20'}`}
          >
            <StatusIcon size={18} className={isSubmitting ? "animate-spin" : ""} />
            {personalViolation ? 'Rules Violation' : onBehalf ? 'Complete Direct Issue' : 'Submit for Approval'}
          </button>
        </div>
      </div>
    </div>
  );
}
