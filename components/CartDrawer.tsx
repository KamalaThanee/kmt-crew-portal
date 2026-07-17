"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ShoppingCart, X, Trash2, PackageCheck, ShieldAlert, Loader2, History as HistoryIcon, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { applyPpeRequestUserFilter, insertPpeRequest } from '@/lib/ppeRequests';
import { deductPpeStock } from '@/lib/ppeStock';
import { isAdminRole } from '@/lib/roles';
import { ensureDirectIssueTimeline, isCrewActive, normalizeCartText as normalize } from '@/lib/cartDrawer';
import { DirectIssuePanel } from '@/components/cart/DirectIssuePanel';
import { notifyOneSignal } from '@/lib/onesignalClient';

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
  const selectedCrew = useMemo(
    () => crews.find((crew) => String(crew.id) === String(targetCrewId)) || null,
    [crews, targetCrewId],
  );

  const isSuitItem = (item: any) => String(item?.item_name || '').toLowerCase().includes('suit');
  const isBootItem = (item: any) => {
    const name = String(item?.item_name || '').toLowerCase();
    return name.includes('safety boot') && !name.includes('rubber');
  };

  const getCartItemKey = (item: any) =>
    [
      String(item?.id ?? item?.inventory_id ?? ''),
      normalize(item?.item_name),
      normalize(item?.color || ''),
      normalize(item?.size || ''),
      normalize(item?.category || ''),
    ].join('|');

  const getInventoryLimit = (item: any) => {
    const stock = Number(item?.stock ?? item?.current_stock ?? item?.quantity ?? item?.qty ?? item?.on_hand ?? NaN);
    return Number.isFinite(stock) && stock >= 0 ? stock : null;
  };

  const getQuotaLimit = (item: any) => {
    if (isSuitItem(item)) return 2;
    if (isBootItem(item)) return 1;
    return null;
  };

  const persistCartItems = (nextCart: any[]) => {
    setCartItems(nextCart);
    localStorage.setItem('kmt_cart', JSON.stringify(nextCart));
    window.dispatchEvent(new CustomEvent('cart-updated', { detail: nextCart.length }));
  };

  const groupedCartItems = useMemo(() => {
    const grouped = new Map<string, { key: string; sample: any; quantity: number }>();

    cartItems.forEach((item) => {
      const key = getCartItemKey(item);
      const existing = grouped.get(key);
      if (existing) {
        existing.quantity += 1;
      } else {
        grouped.set(key, { key, sample: item, quantity: 1 });
      }
    });

    return Array.from(grouped.values());
  }, [cartItems]);

  const getAnnualIssuedCount = (predicate: (item: any) => boolean) => {
    const currentYear = new Date().getFullYear();

    return targetHistory.reduce((total, req) => {
      const issuedAt = new Date(req.created_at);
      if (Number.isNaN(issuedAt.getTime()) || issuedAt.getFullYear() !== currentYear) return total;

      return total + (req.items || []).filter(predicate).length;
    }, 0);
  };

  const getCartCount = (predicate: (item: any) => boolean) => cartItems.filter(predicate).length;

  const getGroupLimitState = (group: { sample: any; quantity: number }) => {
    const stockLimit = getInventoryLimit(group.sample);
    const quotaLimit = getQuotaLimit(group.sample);
    const quotaPredicate = isSuitItem(group.sample) ? isSuitItem : isBootItem(group.sample) ? isBootItem : null;
    const annualIssued = quotaPredicate ? getAnnualIssuedCount(quotaPredicate) : 0;
    const cartQuotaCount = quotaPredicate ? getCartCount(quotaPredicate) : 0;
    const stockBlocked = stockLimit !== null && group.quantity >= stockLimit;
    const quotaBlocked = selectedCrew && quotaLimit !== null && annualIssued + cartQuotaCount >= quotaLimit;

    return {
      stockLimit,
      quotaLimit,
      annualIssued,
      cartQuotaCount,
      stockBlocked,
      quotaBlocked,
      blockReason: stockBlocked
        ? `Only ${stockLimit} ${group.sample.item_name} left in inventory`
        : quotaBlocked
          ? `Annual quota reached for ${isSuitItem(group.sample) ? 'boiler suit' : 'safety boots'}`
          : null,
    };
  };

  const addGroupedItem = (group: { sample: any; quantity: number }) => {
    const limitState = getGroupLimitState(group);
    if (limitState.blockReason) {
      toast.error(limitState.blockReason);
      return;
    }

    persistCartItems([...cartItems, { ...group.sample }]);
  };

  const removeGroupedItem = (key: string) => {
    const removeIndex = cartItems.findIndex((item) => getCartItemKey(item) === key);
    if (removeIndex < 0) return;

    const nextCart = [...cartItems];
    nextCart.splice(removeIndex, 1);
    persistCartItems(nextCart);
  };

  const removeGroup = (key: string) => {
    persistCartItems(cartItems.filter((item) => getCartItemKey(item) !== key));
  };

  const getPpeProfileMismatch = (item: any, crew: any) => {
    if (!crew) return null;

    if (isSuitItem(item)) {
      const expectedColor = String(crew.suit_color || '').trim();
      const expectedSize = String(crew.suit_size || '').trim();
      const actualColor = String(item.color || '').trim();
      const actualSize = String(item.size || '').trim();

      if ((expectedColor && actualColor !== expectedColor) || (expectedSize && actualSize !== expectedSize)) {
        return `Registered boiler suit: ${expectedColor || '-'} | ${expectedSize || '-'}`
      }
    }

    if (isBootItem(item)) {
      const expectedBootSize = String(crew.boot_size || '').trim();
      const actualBootSize = String(item.size || '').trim();
      if (expectedBootSize && actualBootSize !== expectedBootSize) {
        return `Registered safety boots: ${expectedBootSize || '-'}`
      }
    }

    return null;
  };

  const mismatchWarnings = useMemo(() => {
    if (!selectedCrew) return [];
    return groupedCartItems
      .map((group) => ({
        item: group.sample,
        quantity: group.quantity,
        warning: getPpeProfileMismatch(group.sample, selectedCrew),
      }))
      .filter((entry) => entry.warning);
  }, [groupedCartItems, selectedCrew]);

  const getTargetItemStats = (itemName: string) => {
    let count = 0;
    let lastDate = 'Never';

    targetHistory.forEach((req) => {
      const matches = req.items?.filter((i: any) => normalize(i.item_name) === normalize(itemName)) || [];
      if (matches.length === 0) return;

      count += matches.length;
      if (lastDate === 'Never') {
        lastDate = new Date(req.created_at).toLocaleDateString('en-GB');
      }
    });

    return { count, lastDate };
  };

  const cartLimitViolations = useMemo(() => {
    const violations: string[] = [];

    groupedCartItems.forEach((group) => {
      const stockLimit = getInventoryLimit(group.sample);
      if (stockLimit !== null && group.quantity > stockLimit) {
        violations.push(`${group.sample.item_name} exceeds inventory stock (${group.quantity}/${stockLimit})`);
      }
    });

    if (selectedCrew) {
      const suitLimit = 2;
      const bootLimit = 1;
      const suitTotal = getAnnualIssuedCount(isSuitItem) + getCartCount(isSuitItem);
      const bootTotal = getAnnualIssuedCount(isBootItem) + getCartCount(isBootItem);

      if (suitTotal > suitLimit) violations.push(`Boiler suit exceeds annual quota (${suitTotal}/${suitLimit})`);
      if (bootTotal > bootLimit) violations.push(`Safety boots exceeds annual quota (${bootTotal}/${bootLimit})`);
    }

    return violations;
  }, [groupedCartItems, cartItems, targetHistory, selectedCrew]);

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
      if (!selectedCrew) throw new Error('Selected crew not found');

      if (cartLimitViolations.length > 0) {
        toast.error(cartLimitViolations[0]);
        setIsSubmitting(false);
        return;
      }

      if (mismatchWarnings.length > 0) {
        const warningText = mismatchWarnings
          .map((entry) => `- ${entry.item.item_name} x${entry.quantity} ${entry.item.color ? `(${entry.item.color})` : ''} ${entry.item.size ? `[${entry.item.size}]` : ''}: ${entry.warning}`)
          .join('\n');
        const confirmed = window.confirm(
          `Some issued PPE does not match ${selectedCrew.full_name}'s registered size/profile.\n\n${warningText}\n\nDo you want to continue anyway?`,
        );
        if (!confirmed) {
          setIsSubmitting(false);
          return;
        }
      }

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

      await notifyOneSignal({
        type: 'received',
        requestId: data?.id,
        crewId: selectedCrew?.id,
        crewName: selectedCrew?.full_name,
        itemName: cartItems[0]?.item_name || 'PPE item',
        itemsSummary: cartItems.map((item) => `${item.item_name || 'PPE'} × ${Number(item.quantity || item.qty || 1)}`).join(', '),
        actorName: user?.full_name || user?.position,
        actorId: user?.id,
        actorPin: user?.pin,
      });
      window.dispatchEvent(new Event('new-notification'));

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
            {groupedCartItems.map((group) => {
              const item = group.sample;
              const targetStats = targetCrewId ? getTargetItemStats(item.item_name) : null;
              const mismatchWarning = selectedCrew ? getPpeProfileMismatch(item, selectedCrew) : null;
              const limitState = getGroupLimitState(group);

              return (
                <div key={group.key} className="space-y-3 rounded-[28px] border border-white/5 bg-zinc-900 p-4 shadow-md">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-black uppercase leading-tight text-white">{item.item_name}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase text-orange-500">
                        {item.color} | Size: {item.size}
                      </p>
                    </div>
                    <button
                      onClick={() => removeGroup(group.key)}
                      className="p-1 text-zinc-700 hover:text-red-500"
                      title="Remove this item group"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-black/40 p-3">
                    <div>
                      <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Issue quantity</p>
                      <p className="mt-1 text-[11px] font-bold text-zinc-300">
                        {limitState.stockLimit !== null ? `Stock ${group.quantity}/${limitState.stockLimit}` : `${group.quantity} selected`}
                        {limitState.quotaLimit !== null && (
                          <span className="ml-2 text-orange-300">
                            Quota {limitState.annualIssued + limitState.cartQuotaCount}/{limitState.quotaLimit}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => removeGroupedItem(group.key)}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition-colors hover:bg-white/10"
                        title="Decrease quantity"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="min-w-10 text-center text-xl font-black text-white">{group.quantity}</span>
                      <button
                        onClick={() => addGroupedItem(group)}
                        disabled={Boolean(limitState.blockReason)}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-orange-500/30 bg-orange-500/15 text-orange-300 transition-colors hover:bg-orange-500/25 disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-white/5 disabled:text-zinc-700"
                        title={limitState.blockReason || 'Increase quantity'}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  {limitState.blockReason && (
                    <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-red-200">{limitState.blockReason}</p>
                    </div>
                  )}

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

                  {mismatchWarning && (
                    <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3">
                      <p className="text-[8px] font-black uppercase tracking-widest text-amber-300">Profile mismatch</p>
                      <p className="mt-1 text-[11px] font-bold text-amber-100">
                        This item does not match the registered PPE profile.
                      </p>
                      <p className="mt-1 text-[10px] font-semibold text-amber-200">{mismatchWarning}</p>
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
