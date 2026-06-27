"use client";

import { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, X, Trash2, PackageCheck, ShieldAlert, Loader2, History as HistoryIcon } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { applyPpeRequestUserFilter, insertPpeRequest } from '@/lib/ppeRequests';
import { deductPpeStock } from '@/lib/ppeStock';
import { isAdminRole } from '@/lib/roles';
import { ensureDirectIssueTimeline, isCrewActive, normalizeCartText as normalize } from '@/lib/cartDrawer';
import { DirectIssuePanel } from '@/components/cart/DirectIssuePanel';

export default function CartDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [reason, setReason] = useState('');
  const [targetCrewId, setTargetCrewId] = useState('');
  const [crews, setCrews] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [targetHistory, setTargetHistory] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    const uStr = localStorage.getItem('kmt_user');
    if (!uStr) return;

    const u = JSON.parse(uStr);
    setUser(u);
    setCartItems(JSON.parse(localStorage.getItem('kmt_cart') || '[]'));

    if (!isAdminRole(u.position)) return;

    const { data } = await supabase.from('crews').select('*').order('full_name');
    if (data) setCrews(data.filter(isCrewActive));
  }, []);

  useEffect(() => {
    const fetchTargetHistory = async () => {
      if (!targetCrewId) {
        setTargetHistory([]);
        return;
      }

      const targetCrew = crews.find((crew) => String(crew.id) === String(targetCrewId));
      if (!targetCrew) {
        setTargetHistory([]);
        return;
      }

      const targetQuery = await applyPpeRequestUserFilter(
        supabase
          .from('ppe_requests')
          .select('created_at, items')
          .neq('status', 'rejected')
          .order('created_at', { ascending: false }),
        targetCrew,
      );

      const { data } = await targetQuery;
      if (data) setTargetHistory(data);
    };

    void fetchTargetHistory();
  }, [targetCrewId, crews]);

  useEffect(() => {
    const handleOpenCart = () => {
      void loadData();
      setIsOpen(true);
    };

    const handleCartUpdated = () => {
      setCartItems(JSON.parse(localStorage.getItem('kmt_cart') || '[]'));
    };

    window.addEventListener('open-cart', handleOpenCart);
    window.addEventListener('cart-updated', handleCartUpdated);

    return () => {
      window.removeEventListener('open-cart', handleOpenCart);
      window.removeEventListener('cart-updated', handleCartUpdated);
    };
  }, [loadData]);

  const isAdmin = isAdminRole(user?.position);

  const getTargetItemStats = (itemName: string) => {
    let count = 0;
    let lastDate = 'Never';

    targetHistory.forEach((req) => {
      const found = req.items?.find((i: any) => normalize(i.item_name) === normalize(itemName));
      if (!found) return;

      count++;
      if (lastDate === 'Never') {
        lastDate = new Date(req.created_at).toLocaleDateString('en-GB');
      }
    });

    return { count, lastDate };
  };

  const handleCheckout = async () => {
    if (!isAdmin) {
      toast.error('Only admin can issue PPE from this cart');
      return;
    }

    if (cartItems.length === 0) return;
    if (!targetCrewId) {
      toast.error('Please choose the crew member who receives this PPE');
      return;
    }
    if (!reason.trim()) {
      toast.error('Please add an issue note before completing this transaction');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedCrew = crews.find((crew) => String(crew.id) === String(targetCrewId));
      if (!selectedCrew) throw new Error('Selected crew not found');

      const directIssueAt = new Date().toISOString();
      const { data, error } = await insertPpeRequest({
        crew: selectedCrew,
        extra: {
          items: cartItems,
          reason: reason.trim(),
          status: 'received',
          approved_at: directIssueAt,
          received_at: directIssueAt,
          approved_by_name: user?.full_name || 'Admin',
        },
      });

      if (error) throw error;

      await ensureDirectIssueTimeline(data?.id, user?.full_name, directIssueAt);
      await deductPpeStock(cartItems, {
        requestId: data?.id || null,
        actorName: user?.full_name || 'Admin',
        crewName: selectedCrew?.full_name || null,
        movementType: 'direct_issue',
        note: reason.trim(),
      });

      localStorage.setItem('kmt_cart', '[]');
      setReason('');
      setTargetCrewId('');
      setIsOpen(false);
      window.dispatchEvent(new CustomEvent('cart-updated', { detail: 0 }));
      toast.success('Direct issue completed and stock updated');
    } catch (e: any) {
      toast.error(e?.message || 'Unable to complete issue');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;
  if (!isAdmin) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex justify-end">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
      <div className="relative flex h-full w-full max-w-sm flex-col border-l border-orange-500/20 bg-zinc-950 shadow-2xl animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between border-b border-white/5 p-6 shadow-xl">
          <div className="flex items-center gap-3 text-orange-500">
            <ShoppingCart size={24} />
            <h2 className="text-xl font-black uppercase italic tracking-tighter text-white">Issue Cart</h2>
          </div>
          <button onClick={() => setIsOpen(false)} className="p-2 text-zinc-500 transition-colors hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6 no-scrollbar">
          {user && (
            <DirectIssuePanel
              crews={crews}
              enabled
              locked
              targetCrewId={targetCrewId}
              onEnabledChange={() => {}}
              onTargetCrewChange={setTargetCrewId}
            />
          )}

          <div className="space-y-4">
            {cartItems.map((item, idx) => {
              const targetStats = targetCrewId ? getTargetItemStats(item.item_name) : null;
              return (
                <div key={`${item.id}-${idx}`} className="space-y-3 rounded-[28px] border border-white/5 bg-zinc-900 p-4 shadow-md">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-black uppercase leading-tight text-white">{item.item_name}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase text-orange-500">
                        {item.color} | Size: {item.size}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const nextCart = [...cartItems];
                        nextCart.splice(idx, 1);
                        localStorage.setItem('kmt_cart', JSON.stringify(nextCart));
                        window.dispatchEvent(new CustomEvent('cart-updated'));
                      }}
                      className="p-1 text-zinc-700 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {targetStats && (
                    <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/50 p-3">
                      <HistoryIcon size={14} className="text-zinc-600" />
                      <div>
                        <p className="text-[8px] font-black uppercase tracking-tighter text-zinc-500">Personnel History:</p>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-white">
                          {targetStats.count} Total Issued <span className="ml-2 text-zinc-500">Last: {targetStats.lastDate}</span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {cartItems.length === 0 && (
              <div className="py-20 text-center text-xs font-black uppercase tracking-widest italic text-zinc-800 opacity-20">
                <PackageCheck size={48} className="mx-auto mb-4" />
                <p>Select items first</p>
              </div>
            )}
          </div>

          <div className="space-y-3 pt-4">
            <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-zinc-500">Issue Note</label>
            <textarea
              rows={3}
              placeholder="Mandatory: why is this issue needed?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={`w-full resize-none rounded-2xl border bg-black p-4 text-sm text-white outline-none transition-all focus:border-orange-500 ${!reason.trim() ? 'border-red-500/50 animate-pulse' : 'border-white/5'}`}
            />
          </div>
        </div>

        <div className="shrink-0 border-t border-white/5 bg-black/40 p-6">
          <button
            onClick={handleCheckout}
            disabled={cartItems.length === 0 || isSubmitting}
            className="flex w-full items-center justify-center gap-3 rounded-3xl bg-orange-600 py-5 text-xs font-black uppercase text-white shadow-xl shadow-orange-600/20 transition-all active:scale-95 hover:bg-orange-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <ShieldAlert size={18} />}
            Complete Issue
          </button>
        </div>
      </div>
    </div>
  );
}
