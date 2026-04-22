"use client";
import { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, X, Trash2, PackageCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

export default function CartDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [cartItems, setCartItems] = useState<any[]>([]);

  const loadCart = useCallback(() => {
    setCartItems(JSON.parse(localStorage.getItem('kmt_cart') || '[]'));
  }, []);

  useEffect(() => {
    const handleOpen = () => { loadCart(); setIsOpen(true); };
    window.addEventListener('open-cart', handleOpen);
    window.addEventListener('cart-updated', loadCart);
    return () => { 
      window.removeEventListener('open-cart', handleOpen);
      window.removeEventListener('cart-updated', loadCart); 
    };
  }, [loadCart]);

  const removeItem = (idx: number) => {
    const newCart = [...cartItems]; newCart.splice(idx, 1);
    localStorage.setItem('kmt_cart', JSON.stringify(newCart));
    window.dispatchEvent(new CustomEvent('cart-updated', { detail: newCart.length }));
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    const user = JSON.parse(localStorage.getItem('kmt_user') || '{}');
    const { error } = await supabase.from('ppe_requests').insert({
      crew_id: user.id, crew_name: user.full_name, items: cartItems, status: 'pending'
    });

    if (!error) {
      localStorage.setItem('kmt_cart', '[]');
      window.dispatchEvent(new CustomEvent('cart-updated', { detail: 0 }));
      setIsOpen(false);
      toast.success('PPE Request Submitted Successfully!');
    } else {
      toast.error('Submission Failed');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex justify-end">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
      <div className="relative w-full max-w-sm bg-zinc-950 h-full shadow-2xl border-l border-orange-500/20 flex flex-col animate-in slide-in-from-right duration-300">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3 text-orange-500"><ShoppingCart size={24}/><h2 className="text-xl font-black uppercase italic">My Cart</h2></div>
          <button onClick={() => setIsOpen(false)} className="p-2 bg-white/5 rounded-full text-zinc-500 hover:text-white transition-colors"><X size={20}/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {cartItems.length === 0 ? (
            <div className="text-center py-20 text-zinc-700 font-black uppercase text-xs tracking-widest"><PackageCheck size={48} className="mx-auto mb-4 opacity-20"/><p>Cart is empty</p></div>
          ) : (
            cartItems.map((item, idx) => (
              <div key={idx} className="bg-white/5 p-4 rounded-2xl border border-white/5 flex justify-between items-center group">
                <div><p className="text-white font-bold text-sm uppercase">{item.item_name}</p><p className="text-[10px] text-orange-500 font-black uppercase mt-1 tracking-widest">{item.color} | Size: {item.size}</p></div>
                <button onClick={() => removeItem(idx)} className="text-zinc-600 hover:text-red-500 p-2 transition-colors"><Trash2 size={18}/></button>
              </div>
            ))
          )}
        </div>
        <div className="p-6 bg-black/40 border-t border-white/5">
          <button onClick={handleCheckout} disabled={cartItems.length === 0} className="w-full py-5 bg-orange-600 hover:bg-orange-500 text-white rounded-3xl font-black uppercase text-xs tracking-widest shadow-xl shadow-orange-600/20 disabled:opacity-20 transition-all active:scale-95">Submit Request ({cartItems.length})</button>
        </div>
      </div>
    </div>
  );
}
