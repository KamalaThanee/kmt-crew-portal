"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ProfileMenu } from '@/components/navbar/ProfileMenu';
import { PushNudge } from '@/components/navbar/PushNudge';
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  FileBadge,
  ShieldCheck,
  ShoppingCart,
  User,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getOneSignalStatus, requestOneSignalPermission } from '@/lib/onesignalClient';
import { getMobileNavLabel, getNavbarMenuItems } from '@/lib/navbar';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { type AdminActionItem, type CrewActionItem, useNavbarNotifications } from '@/hooks/useNavbarNotifications';
import { toast } from 'sonner';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, mounted, isAdmin, logout } = useCurrentUser();
  const [showProfile, setShowProfile] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [oneSignalStatus, setOneSignalStatus] = useState<Record<string, string>>({});
  const [pushActionMessage, setPushActionMessage] = useState('');
  const [showPushNudge, setShowPushNudge] = useState(false);

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
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
    };

    window.addEventListener('cart-updated', handleCartUpdate);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener('cart-updated', handleCartUpdate);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const totalPersonalAdminUpdates = (notifData.personalUpdates || []).length;
  const handleEnablePush = async (hideNudgeOnSuccess = false) => {
    setPushActionMessage('Requesting permission...');
    try {
      const status = await requestOneSignalPermission();
      setOneSignalStatus(status);
      setPushActionMessage(status.message || '');
      if (status.permission === 'true' && status.optedIn === 'true') {
        if (hideNudgeOnSuccess) setShowPushNudge(false);
        toast.success('Push notifications enabled');
      } else {
        toast.message(status.message || 'Notification permission was not granted');
      }
    } catch (error: any) {
      const message = error?.message || 'Unable to request push permission';
      setPushActionMessage(message);
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
                  pathname === item.href
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
              <div className="absolute right-0 top-12 w-80 bg-zinc-900 border border-white/10 rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 z-[110]">
                <div className="p-5 bg-black/40 border-b border-white/5">
                  <h3 className="text-white font-black italic uppercase text-lg">Notifications</h3>
                  <p className="text-orange-500 text-[10px] font-bold tracking-widest mt-1">
                    {isAdmin ? 'Action Center' : 'Recent Actions'}
                  </p>
                </div>

                <div className="p-2 space-y-1 bg-black/20">
                  {isAdmin ? (
                    <>
                      <div className="px-1 pt-2">
                        <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-widest text-amber-300">
                          PPE Request Feed
                        </p>
                        {(notifData.pendingActions || []).length > 0 ? (
                          <div className="space-y-2">
                            {(notifData.pendingActions || []).map((item: AdminActionItem) => {
                              const Icon = item.icon;
                              return (
                                <Link
                                  key={item.id}
                                  href={item.href}
                                  onClick={() => setShowNotif(false)}
                                  className="flex items-center justify-between gap-3 p-4 hover:bg-white/5 rounded-2xl transition-all group border border-amber-500/10 bg-amber-500/[0.04]"
                                >
                                  <div className="flex items-center gap-4 min-w-0">
                                    <div className="p-2 rounded-xl border border-amber-500/20 bg-amber-500/15 text-amber-300">
                                      <Icon size={16} />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-white uppercase truncate">{item.title}</p>
                                      <p className="text-[9px] text-zinc-400 mt-1 normal-case">{item.description}</p>
                                      <p className="text-[9px] text-amber-300 mt-2 normal-case font-black">{item.meta}</p>
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-2 shrink-0">
                                    <span className="px-2 py-1 rounded-md text-[9px] font-black bg-amber-400 text-black">
                                      {item.countLabel || 'NEW'}
                                    </span>
                                    <ArrowRight size={14} className="text-zinc-600 group-hover:text-orange-400" />
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                            No new PPE requests right now
                          </div>
                        )}
                      </div>

                      {totalPersonalAdminUpdates > 0 && (
                        <div className="px-1 pt-3">
                          <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-widest text-emerald-300">
                            Your Request Updates
                          </p>
                          <div className="space-y-2">
                            {(notifData.personalUpdates || []).map((item: CrewActionItem) => {
                              const approved = item.status === 'approved';
                              return (
                                <Link
                                  key={`personal-${item.id}`}
                                  href="/my-requests"
                                  onClick={() => setShowNotif(false)}
                                  className="flex items-center justify-between gap-3 p-4 hover:bg-white/5 rounded-2xl transition-all group border border-emerald-500/10 bg-emerald-500/[0.04]"
                                >
                                  <div className="flex items-center gap-4 min-w-0">
                                    <div className={`p-2 rounded-xl ${approved ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                      {approved ? <CheckCircle2 size={16}/> : <XCircle size={16}/>}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-white uppercase truncate">{item.title}</p>
                                      <p className="text-[9px] text-zinc-400 mt-1 normal-case line-clamp-2">{item.description}</p>
                                    </div>
                                  </div>
                                  <ArrowRight size={14} className="text-zinc-600 group-hover:text-emerald-400 shrink-0" />
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {(notifData.personalApprovedCount || 0) > 0 && (
                        <Link
                          href="/my-requests"
                          onClick={() => setShowNotif(false)}
                          className="mx-1 flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3"
                        >
                          <div>
                            <p className="text-[10px] font-black uppercase text-emerald-300">Ready to receive</p>
                            <p className="text-[9px] text-emerald-100/80 mt-1 normal-case">
                              {notifData.personalApprovedCount} approved request{notifData.personalApprovedCount > 1 ? 's are' : ' is'} waiting for your confirmation
                            </p>
                          </div>
                          <span className="bg-emerald-400 text-black px-2 py-1 rounded-md text-[9px] font-black">
                            ACTION
                          </span>
                        </Link>
                      )}

                      {(notifData.personalCertActions || []).length > 0 && (
                        <div className="px-1 pt-3">
                          <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-widest text-sky-300">
                            My Certificates
                          </p>
                          <div className="space-y-2">
                            {(notifData.personalCertActions || []).map((item: CrewActionItem) => (
                              <Link
                                key={item.id}
                                href={item.href || '/certificates?tab=personal'}
                                onClick={() => setShowNotif(false)}
                                className="flex items-center justify-between gap-3 p-4 hover:bg-white/5 rounded-2xl transition-all group border border-sky-500/10 bg-sky-500/[0.04]"
                              >
                                <div className="flex items-center gap-4 min-w-0">
                                  <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400">
                                    <FileBadge size={16}/>
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-white uppercase truncate">{item.title}</p>
                                    <p className="text-[9px] text-zinc-400 mt-1 normal-case line-clamp-2">{item.description}</p>
                                  </div>
                                </div>
                                <ArrowRight size={14} className="text-zinc-600 group-hover:text-sky-400 shrink-0" />
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                    </>
                  ) : (
                    <>
                      {(notifData.updates || []).map((item: CrewActionItem) => {
                        const approved = item.status === 'approved';
                        return (
                          <Link
                            key={item.id}
                            href="/my-requests"
                            onClick={() => setShowNotif(false)}
                            className="flex items-center justify-between gap-3 p-4 hover:bg-white/5 rounded-2xl transition-all group"
                          >
                            <div className="flex items-center gap-4 min-w-0">
                              <div className={`p-2 rounded-xl ${approved ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                {approved ? <CheckCircle2 size={16}/> : <XCircle size={16}/>}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-white uppercase truncate">{item.title}</p>
                                <p className="text-[9px] text-zinc-500 mt-1 normal-case line-clamp-2">{item.description}</p>
                              </div>
                            </div>
                            <ArrowRight size={14} className="text-zinc-600 group-hover:text-orange-400 shrink-0" />
                          </Link>
                        );
                      })}

                      {(notifData.personalCertActions || []).length > 0 && (
                        <div className="pt-2">
                          <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-widest text-sky-300">
                            My Certificates
                          </p>
                          <div className="space-y-2">
                            {(notifData.personalCertActions || []).map((item: CrewActionItem) => (
                              <Link
                                key={item.id}
                                href={item.href || '/certificates?tab=personal'}
                                onClick={() => setShowNotif(false)}
                                className="flex items-center justify-between gap-3 p-4 hover:bg-white/5 rounded-2xl transition-all group border border-sky-500/10 bg-sky-500/[0.04]"
                              >
                                <div className="flex items-center gap-4 min-w-0">
                                  <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400">
                                    <FileBadge size={16}/>
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-white uppercase truncate">{item.title}</p>
                                    <p className="text-[9px] text-zinc-400 mt-1 normal-case line-clamp-2">{item.description}</p>
                                  </div>
                                </div>
                                <ArrowRight size={14} className="text-zinc-600 group-hover:text-sky-400 shrink-0" />
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      {notifData.approvedCount > 0 && (
                        <Link
                          href="/my-requests"
                          onClick={() => setShowNotif(false)}
                          className="flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3"
                        >
                          <div>
                            <p className="text-[10px] font-black uppercase text-emerald-300">Ready to receive</p>
                            <p className="text-[9px] text-emerald-100/80 mt-1 normal-case">
                              {notifData.approvedCount} approved request{notifData.approvedCount > 1 ? 's are' : ' is'} waiting for your confirmation
                            </p>
                          </div>
                          <span className="bg-emerald-400 text-black px-2 py-1 rounded-md text-[9px] font-black">
                            ACTION
                          </span>
                        </Link>
                      )}
                    </>
                  )}

                  {notifData.pending + notifData.lowStock + notifData.expiredCerts + (notifData.personalCertAlertCount || 0) === 0 && (notifData.updates || []).length === 0 && (
                    <div className="text-center p-6 text-zinc-600 text-[10px] uppercase font-black tracking-widest">
                      No Alerts
                    </div>
                  )}
                </div>
              </div>
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
          const isActive = pathname === item.href;
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
    </>
  );
}
