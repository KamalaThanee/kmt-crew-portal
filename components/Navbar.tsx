"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { NotificationDropdown } from '@/components/navbar/NotificationDropdown';
import { ProfileMenu } from '@/components/navbar/ProfileMenu';
import { PushNudge } from '@/components/navbar/PushNudge';
import { PpeSizeUpdateModal } from '@/components/navbar/PpeSizeUpdateModal';
import {
  Bell,
  Moon,
  ShieldCheck,
  ShoppingCart,
  Sun,
  User,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getOneSignalStatus, requestOneSignalPermission } from '@/lib/onesignalClient';
import { getMobileNavLabel, getNavbarMenuItems } from '@/lib/navbar';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNavbarNotifications } from '@/hooks/useNavbarNotifications';
import { applyTheme, getStoredTheme, type KmtTheme } from '@/components/ThemeBridge';
import { toast } from 'sonner';

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
  const [theme, setTheme] = useState<KmtTheme>('light');

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
    if (!mounted) return;

    const syncTheme = () => setTheme(getStoredTheme());
    syncTheme();
    window.addEventListener('kmt-theme-changed', syncTheme);

    return () => window.removeEventListener('kmt-theme-changed', syncTheme);
  }, [mounted]);

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

  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    setTheme(nextTheme);
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

      <nav className="fixed top-4 left-1/2 -translate-x-1/2 w-[94%] max-w-6xl h-14 bg-[var(--nav-bg)] backdrop-blur-xl border border-[var(--nav-border)] rounded-2xl z-[100] px-4 flex items-center justify-between shadow-2xl transition-colors duration-300">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push(isAdmin ? '/admin/dashboard' : '/dashboard')}>
            <ShieldCheck size={22} className="text-orange-500" />
            <span className="font-black text-lg tracking-tighter text-[var(--app-text)] uppercase">KMT</span>
          </div>
          <div className="hidden md:flex items-center gap-1">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  isNavItemActive(item.href)
                    ? 'text-white bg-orange-600 shadow-lg shadow-orange-600/20'
                    : 'text-[var(--text-muted)] hover:text-orange-500'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {user && (
            <button
              type="button"
              onClick={() => setShowProfile(true)}
              className="hidden max-w-[210px] rounded-xl border border-orange-500/20 bg-[var(--card-soft)] px-3 py-2 text-left transition-all hover:border-orange-500/45 hover:bg-[var(--card-soft-hover)] lg:block"
              title={`${user.full_name || 'Crew'} | ${user.position || 'Crew'}`}
            >
              <p className="truncate text-[10px] font-black uppercase leading-tight tracking-wide text-[var(--app-text)]">
                {user.full_name || 'Crew'}
              </p>
              <p className="mt-0.5 truncate text-[8px] font-black uppercase tracking-[0.18em] text-orange-300">
                {user.position || 'Crew'}
              </p>
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleTheme}
            className="hidden h-9 w-9 items-center justify-center rounded-xl border border-orange-500/20 bg-[var(--card-soft)] text-[var(--icon-muted)] transition-all hover:border-orange-500/45 hover:text-orange-500 md:flex"
            title={theme === 'dark' ? 'Switch to day mode' : 'Switch to dark mode'}
            aria-label={theme === 'dark' ? 'Switch to day mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          <button onClick={() => window.dispatchEvent(new CustomEvent('open-cart'))} className="p-2.5 text-[var(--icon-muted)] hover:text-orange-500 relative transition-colors">
            <ShoppingCart size={18} />
            {cartCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-orange-600 text-white text-[8px] font-black rounded-full flex items-center justify-center border border-black">
                {cartCount}
              </span>
            )}
          </button>

          <div className="relative" ref={notifRef}>
            <button onClick={handleOpenNotif} className="p-2.5 text-[var(--icon-muted)] hover:text-orange-500 relative transition-colors">
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
                  : 'bg-[var(--card-soft)] border-orange-500/15 text-[var(--icon-muted)] hover:bg-[var(--card-soft-hover)]'
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

      <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] h-16 bg-[var(--nav-bg)] backdrop-blur-2xl border border-[var(--nav-border)] rounded-3xl z-[100] px-2 shadow-2xl flex items-center justify-around transition-colors duration-300">
        {menuItems.slice(0, isAdmin ? 5 : 4).map((item) => {
          const Icon = item.icon;
          const isActive = isNavItemActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 w-full h-full relative transition-all ${
                isActive ? 'text-orange-500' : 'text-[var(--text-muted)]'
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
