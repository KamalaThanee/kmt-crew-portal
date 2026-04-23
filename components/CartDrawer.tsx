"use client";
import { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, X, Trash2, PackageCheck, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

export default function CartDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [reason, setReason] = useState("");
  const [targetCrew, setTargetCrew] = useState<any>(null); 
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(() => {
    setCartItems(JSON.parse(localStorage.getItem('kmt_cart') || '[]'));
    setTargetCrew(JSON.parse(localStorage.getItem('kmt_target_crew') || 'null'));
  }, []);

  useEffect(() => {
    window.addEventListener('open-cart', () => { loadData(); setIsOpen(true); });
    window.addEventListener('cart-updated', loadData);
    return () => {
      window.removeEventListener('cart-updated', loadData);
    };
  }, [loadData]);

  const removeItem = (idx: number) => {
    const newCart = [...cartItems]; 
    newCart.splice(idx, 1);
    localStorage.setItem('kmt_cart', JSON.stringify(newCart));
    loadData();
    window.dispatchEvent(new CustomEvent('cart-updated', { detail: newCart.length }));
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    setIsSubmitting(true);
    try {
      const currentUser = JSON.parse(localStorage.getItem('kmt_user') || '{}');
      const crewId = targetCrew ? targetCrew.id : currentUser.id;
      const crewName = targetCrew ? targetCrew.full_name : currentUser.full_name;

      const { error } = await supabase.from('ppe_requests').insert({
        crew_id: crewId, crew_name: crewName, items: cartItems, reason: reason.trim() || 'No reason provided', status: 'pending'
      });

      if (error) throw error;
      localStorage.setItem('kmt_cart', '[]');
      setCartItems([]); setReason("");
      window.dispatchEvent(new CustomEvent('cart-updated', { detail: 0 }));
      setIsOpen(false);
      toast.success(`Request submitted for ${crewName}!`);
    } catch (e) {
      toast.error('Submission Failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex justify-end">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
      <div className="relative w-full max-w-sm bg-zinc-950 h-full shadow-2xl border-l border-orange-500/20 flex flex-col animate-in slide-in-from-right duration-300">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3 text-orange-500"><ShoppingCart size={24}/><h2 className="text-xl font-black uppercase italic">My Cart</h2></div>
          <button onClick={() => setIsOpen(false)} className="p-2 bg-white/5 rounded-full text-zinc-500 hover:text-white"><X size={20}/></button>
        </div>
        {targetCrew && <div className="bg-orange-500/10 border-b border-orange-500/20 p-4 text-center"><p className="text-[10px] text-orange-500 font-black uppercase">On behalf of: <span className="text-white">{targetCrew.full_name}</span></p></div>}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
          {cartItems.length === 0 ? <div className="text-center py-20 text-zinc-700 font-black uppercase text-xs tracking-widest"><PackageCheck size={48} className="mx-auto mb-4 opacity-20"/><p>Cart is empty</p></div> : 
            cartItems.map((item, idx) => (
              <div key={idx} className="bg-white/5 p-4 rounded-3xl border border-white/5 flex justify-between items-center">
                <div><p className="text-white font-bold text-sm uppercase leading-tight">{item.item_name}</p><p className="text-[10px] text-orange-500 font-black uppercase mt-1">{item.color} | Size: {item.size}</p></div>
                <button onClick={() => removeItem(idx)} className="text-zinc-600 hover:text-red-500 p-2"><Trash2 size={18}/></button>
              </div>
            ))
          }
          {cartItems.length > 0 && <div className="mt-8 space-y-2"><label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Reason</label><textarea rows={3} placeholder="e.g. Broken boots..." value={reason} onChange={(e) => setReason(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-2xl p-4 text-sm text-white outline-none focus:border-orange-500 transition-all resize-none"></textarea></div>}
        </div>
        <div className="p-6 bg-black/40 border-t border-white/5"><button onClick={handleCheckout} disabled={cartItems.length === 0 || isSubmitting} className="w-full py-5 bg-orange-600 hover:bg-orange-500 text-white rounded-3xl font-black uppercase text-xs shadow-xl disabled:opacity-20 active:scale-95 transition-all"><Save size={18} className="inline mr-2"/> Submit Request ({cartItems.length})</button></div>
      </div>
    </div>
  );
}
