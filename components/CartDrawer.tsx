"use client";
import { useState, useEffect } from 'react';
import { ShoppingCart, X, Trash2, PackageCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function CartDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [cartItems, setCartItems] = useState<any[]>([]);

  useEffect(() => {
    const handleOpen = () => {
      const savedCart = JSON.parse(localStorage.getItem('kmt_cart') || '[]');
      setCartItems(savedCart);
      setIsOpen(true);
    };
    window.addEventListener('open-cart', handleOpen);
    return () => window.removeEventListener('open-cart', handleOpen);
  }, []);

  const removeItem = (index: number) => {
    const newCart = [...cartItems];
    newCart.splice(index, 1);
    setCartItems(newCart);
    localStorage.setItem('kmt_cart', JSON.stringify(newCart));
    window.dispatchEvent(new CustomEvent('cart-updated', { detail: newCart.length }));
    toast.success('ลบรายการแล้ว');
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) return;
    // ส่ง Event หรือเรียก Function เบิกของตรงนี้
    toast.info('กำลังส่งคำขอเบิกอุปกรณ์...');
    // จำลองการเบิกสำเร็จ
    setTimeout(() => {
      localStorage.setItem('kmt_cart', '[]');
      setCartItems([]);
      window.dispatchEvent(new CustomEvent('cart-updated', { detail: 0 }));
      setIsOpen(false);
      toast.success('ส่งคำขอเบิกเรียบร้อยแล้ว!');
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
      <div className="relative w-full max-w-md bg-slate-900 h-full shadow-2xl border-l border-white/10 flex flex-col animate-in slide-in-from-right duration-300">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShoppingCart className="text-blue-500" />
            <h2 className="text-xl font-bold text-white">รายการเบิกอุปกรณ์</h2>
          </div>
          <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-slate-400">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {cartItems.length === 0 ? (
            <div className="text-center py-20 text-slate-500">
              <PackageCheck size={48} className="mx-auto mb-4 opacity-20" />
              <p>ยังไม่มีรายการในตะกร้า</p>
            </div>
          ) : (
            cartItems.map((item, idx) => (
              <div key={idx} className="bg-white/5 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                <div>
                  <p className="text-white font-bold">{item.item_name || item.name}</p>
                  <p className="text-xs text-slate-400">Size: {item.size || 'N/A'}</p>
                </div>
                <button onClick={() => removeItem(idx)} className="text-red-400 p-2 hover:bg-red-500/10 rounded-lg">
                  <Trash2 size={18} />
                </button>
              </div>
            ))
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="p-6 border-t border-white/10 bg-slate-900/50">
            <button 
              onClick={handleCheckout}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
            >
              ยืนยันการขอเบิก ({cartItems.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
