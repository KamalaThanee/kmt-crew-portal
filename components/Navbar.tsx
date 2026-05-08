"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { NotificationDropdown } from '@/components/navbar/NotificationDropdown';
import { ProfileMenu } from '@/components/navbar/ProfileMenu';
import { PushNudge } from '@/components/navbar/PushNudge';
import { supabase } from '@/lib/supabase';
import {
  Bell,
  Ruler,
  Save,
  ShieldCheck,
  ShoppingCart,
  User,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getOneSignalStatus, requestOneSignalPermission } from '@/lib/onesignalClient';
import { getMobileNavLabel, getNavbarMenuItems } from '@/lib/navbar';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNavbarNotifications } from '@/hooks/useNavbarNotifications';
import { toast } from 'sonner';

const uniqueSorted = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, mounted, isAdmin, logout } = useCurrentUser();
  const [showProfile, setShowProfile] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [oneSignalStatus, setOneSignalStatus] = useState<Record<string, string>>({});
  const [showPushNudge, setShowPushNudge] = useState(false);
  const [showPpeSizeModal, setShowPpeSizeModal] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const { notifData, unreadCount, handleOpenNotif } = useNavbarNotifications({
    user,
    isAdmin,
    pathname,
    setShowNotif,
    setShowProfile,
  });

  const menuItems = useMemo(
    () => getNavbarMenuItems(isAdmin),
    [isAdmin],
  );

  const isNavItemActive = (href: string) => (
    pathname === href ||
    (href === '/admin/approvals' && pathname.startsWith('/admin/history')) ||
    (href === '/certificates' && pathname.startsWith('/admin/ship-certificates'))
  );

  useEffect(() => {
    if (!mounted || !user?.id) return;

    const dismissedKey = `kmt_push_nudge_dismissed_${user.id}`;
    if (localStorage.getItem(dismissedKey) === 'true') return;

    const timeout = window.setTimeout(() => {
      getOneSignalStatus((status) => {
        setOneSignalStatus(status);
        setShowPushNudge(status.optedIn !== 'true');
      });
    }, 2500);

    return () => window.clearTimeout(timeout);
  }, [mounted, user?.id]);

  useEffect(() => {
    const handleCartUpdate = (e: any) => setCartCount(e.detail);
    const handleOpenPpeSizeUpdate = () => setShowPpeSizeModal(true);
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
    };

    window.addEventListener('cart-updated', handleCartUpdate);
    window.addEventListener('open-ppe-size-update', handleOpenPpeSizeUpdate);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener('cart-updated', handleCartUpdate);
      window.removeEventListener('open-ppe-size-update', handleOpenPpeSizeUpdate);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleEnablePush = async (hideNudgeOnSuccess = false) => {
    try {
      const status = await requestOneSignalPermission();
      setOneSignalStatus(status);
      if (status.permission === 'true' && status.optedIn === 'true') {
        if (hideNudgeOnSuccess) setShowPushNudge(false);
        toast.success('Push notifications enabled');
      } else {
        toast.message(status.message || 'Notification permission was not granted');
      }
    } catch (error: any) {
      const message = error?.message || 'Unable to request push permission';
      toast.error(message);
    }
  };

  if (!mounted || ['/login', '/register'].includes(pathname)) return null;

  return (
    <>
      {showPushNudge && (
        <PushNudge
          userId={user?.id}
          onEnable={() => handleEnablePush(true)}
          onDismiss={() => setShowPushNudge(false)}
        />
      )}

      <nav className="fixed top-4 left-1/2 -translate-x-1/2 w-[94%] max-w-6xl h-14 bg-black/80 backdrop-blur-xl border border-orange-500/20 rounded-2xl z-[100] px-4 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push(isAdmin ? '/admin/dashboard' : '/dashboard')}>
            <ShieldCheck size={22} className="text-orange-500" />
            <span className="font-black text-lg tracking-tighter text-white uppercase">KMT</span>
          </div>
          <div className="hidden md:flex items-center gap-1">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  isNavItemActive(item.href)
                    ? 'text-white bg-orange-600 shadow-lg shadow-orange-600/20'
                    : 'text-zinc-500 hover:text-orange-400'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => window.dispatchEvent(new CustomEvent('open-cart'))} className="p-2.5 text-zinc-500 hover:text-orange-500 relative transition-colors">
            <ShoppingCart size={18} />
            {cartCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-orange-600 text-white text-[8px] font-black rounded-full flex items-center justify-center border border-black">
                {cartCount}
              </span>
            )}
          </button>

          <div className="relative" ref={notifRef}>
            <button onClick={handleOpenNotif} className="p-2.5 text-zinc-500 hover:text-orange-500 relative transition-colors">
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-4 h-4 px-1 bg-red-600 text-white text-[8px] font-black rounded-full flex items-center justify-center border border-black animate-pulse">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {showNotif && (
              <NotificationDropdown
                isAdmin={isAdmin}
                notifData={notifData}
                onClose={() => setShowNotif(false)}
                onOpenPpeSizeModal={() => setShowPpeSizeModal(true)}
              />
            )}
          </div>

          <div className="relative" ref={profileRef}>
            <button
              onClick={() => {
                const nextProfileState = !showProfile;
                setShowProfile(nextProfileState);
                setShowNotif(false);
                if (nextProfileState) {
                  getOneSignalStatus(setOneSignalStatus);
                }
              }}
              className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all ${
                showProfile
                  ? 'bg-orange-600 border-orange-400 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]'
                  : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'
              }`}
            >
              <User size={18} />
            </button>

            {showProfile && (
              <ProfileMenu
                user={user}
                isAdmin={isAdmin}
                pushOptedIn={oneSignalStatus.optedIn === 'true'}
                onEnablePush={() => handleEnablePush(false)}
                onClose={() => setShowProfile(false)}
                onLogout={() => {
                  logout();
                  router.push('/login');
                }}
              />
            )}
          </div>
        </div>
      </nav>

      <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] h-16 bg-black/90 backdrop-blur-2xl border border-orange-500/20 rounded-3xl z-[100] px-2 shadow-2xl flex items-center justify-around">
        {menuItems.slice(0, isAdmin ? 5 : 4).map((item) => {
          const Icon = item.icon;
          const isActive = isNavItemActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 w-full h-full relative transition-all ${
                isActive ? 'text-orange-500' : 'text-zinc-500'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[7px] font-black uppercase tracking-tighter">
                {getMobileNavLabel(item.name)}
              </span>
              {isActive && <div className="absolute bottom-1 w-5 h-0.5 bg-orange-500 rounded-full shadow-[0_0_10px_#f97316]"></div>}
            </Link>
          );
        })}
      </nav>

      {showPpeSizeModal && user && (
        <PpeSizeUpdateModal
          user={user}
          onClose={() => setShowPpeSizeModal(false)}
          onSaved={(nextUser) => {
            void nextUser;
            setShowPpeSizeModal(false);
            window.dispatchEvent(new Event('kmt-user-changed'));
            window.dispatchEvent(new Event('new-notification'));
            toast.success('PPE sizes confirmed');
          }}
        />
      )}
    </>
  );
}

function PpeSizeUpdateModal({
  user,
  onClose,
  onSaved,
}: {
  user: any
  onClose: () => void
  onSaved: (nextUser: any) => void
}) {
  const [activeWindow, setActiveWindow] = useState<any>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [form, setForm] = useState({
    suit_color: user.suit_color || '',
    suit_size: user.suit_size || '',
    boot_size: user.boot_size || '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [windowRes, inventoryRes] = await Promise.all([
        supabase
          .from('ppe_size_windows')
          .select('*')
          .eq('status', 'open')
          .order('opened_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('ppe_inventory').select('item_name, color, size'),
      ]);
      if (!windowRes.error) setActiveWindow(windowRes.data || null);
      if (!inventoryRes.error) setInventory(inventoryRes.data || []);
      setLoading(false);
    };
    load();
  }, []);

  const suitInventory = inventory.filter((item) => String(item.item_name || '').toLowerCase().includes('suit'));
  const bootInventory = inventory.filter((item) => {
    const name = String(item.item_name || '').toLowerCase();
    return name.includes('safety boot') && !name.includes('rubber');
  });
  const suitColorOptions = uniqueSorted(suitInventory.map((item) => String(item.color || '').trim()));
  const suitSizeOptions = uniqueSorted(suitInventory.map((item) => String(item.size || '').trim()));
  const bootSizeOptions = uniqueSorted(bootInventory.map((item) => String(item.size || '').trim()));
  const sizeWindowConfirmed = activeWindow?.id && String(user?.ppe_size_confirmed_window_id || '') === String(activeWindow.id);

  const save = async () => {
    if (!activeWindow?.id) return toast.error('No active PPE size update window');
    if (!form.suit_color || !form.suit_size || !form.boot_size) return toast.error('Please select boiler suit color, suit size, and safety boots size');

    setSaving(true);
    const payload = {
      suit_color: form.suit_color,
      suit_size: form.suit_size,
      boot_size: form.boot_size,
      ppe_size_confirmed_at: new Date().toISOString(),
      ppe_size_confirmed_window_id: activeWindow.id,
    };
    const { error } = await supabase.from('crews').update(payload).eq('id', user.id);
    setSaving(false);
    if (error) return toast.error(`${error.message}. Run sql/ppe_size_update_window.sql first.`);

    const nextUser = { ...user, ...payload };
    localStorage.setItem('kmt_user', JSON.stringify(nextUser));
    onSaved(nextUser);
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-2xl">
      <div className="w-full max-w-3xl overflow-hidden rounded-[42px] border border-orange-500/25 bg-zinc-950 shadow-2xl">
        <div className="flex items-start justify-between border-b border-white/10 p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-400">PPE Size Survey</p>
            <h2 className="mt-2 text-3xl font-black italic uppercase text-white">Boiler Suit & Safety Boots</h2>
            <p className="mt-1 text-xs normal-case text-zinc-500">Confirm your current sizes for the next PPE order round.</p>
          </div>
          <button onClick={onClose} className="rounded-2xl bg-white/5 p-3 text-zinc-400 hover:bg-white/10 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[75vh] space-y-5 overflow-y-auto p-6">
          {loading ? (
            <div className="rounded-[28px] border border-white/10 bg-black/40 p-8 text-center text-xs font-black uppercase tracking-widest text-orange-400">Loading size options...</div>
          ) : !activeWindow ? (
            <div className="rounded-[28px] border border-white/10 bg-black/40 p-8 text-center text-xs font-black uppercase tracking-widest text-zinc-500">No active PPE size survey right now</div>
          ) : (
            <>
              <div className="rounded-[28px] border border-amber-500/20 bg-amber-500/10 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-black uppercase text-white">{activeWindow.title || 'PPE Size Update'}</p>
                    {activeWindow.deadline_at && (
                      <p className="mt-1 text-[10px] font-bold normal-case text-amber-200">Deadline: {new Date(activeWindow.deadline_at).toLocaleString()}</p>
                    )}
                  </div>
                  <span className={`rounded-full px-4 py-2 text-[9px] font-black uppercase ${sizeWindowConfirmed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-orange-600 text-white'}`}>
                    {sizeWindowConfirmed ? 'Confirmed, update if needed' : 'Action required'}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[24px] border border-white/10 bg-black/40 p-4">
                  <label className="mb-2 block text-[9px] font-black uppercase tracking-[0.25em] text-zinc-500">Boiler suit color</label>
                  <select value={form.suit_color} onChange={(event) => setForm((prev) => ({ ...prev, suit_color: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-xs font-black text-white outline-none focus:border-orange-500">
                    <option value="">Select color</option>
                    {suitColorOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-black/40 p-4">
                  <label className="mb-2 block text-[9px] font-black uppercase tracking-[0.25em] text-zinc-500">Boiler suit size</label>
                  <select value={form.suit_size} onChange={(event) => setForm((prev) => ({ ...prev, suit_size: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-xs font-black text-white outline-none focus:border-orange-500">
                    <option value="">Select suit size</option>
                    {suitSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-black/40 p-4">
                  <label className="mb-2 block text-[9px] font-black uppercase tracking-[0.25em] text-zinc-500">Safety boots size</label>
                  <select value={form.boot_size} onChange={(event) => setForm((prev) => ({ ...prev, boot_size: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-xs font-black text-white outline-none focus:border-orange-500">
                    <option value="">Select boots size</option>
                    {bootSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-black/35 p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-orange-500/10 p-3 text-orange-300"><Ruler size={20} /></div>
                  <div>
                    <p className="text-xs font-black uppercase text-white">Size chart reference</p>
                    <p className="mt-1 text-[10px] normal-case text-zinc-500">Use your current PPE label or company size chart. Admin can update this area with a detailed chart later.</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-white/5 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-200">Boiler suit</p>
                    <p className="mt-2 text-[11px] normal-case text-zinc-400">Select color and size from available inventory options.</p>
                  </div>
                  <div className="rounded-2xl bg-white/5 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-200">Safety boots</p>
                    <p className="mt-2 text-[11px] normal-case text-zinc-400">Select the boot size format shown in inventory, e.g. Size 8 / 42.</p>
                  </div>
                </div>
              </div>

              <button onClick={save} disabled={saving} className="w-full rounded-[24px] bg-orange-600 px-6 py-5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-orange-600/20 disabled:opacity-50">
                <Save size={16} className="mr-2 inline" /> {saving ? 'Saving...' : 'Confirm Size'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
