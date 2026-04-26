"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileBadge,
  History,
  LogOut,
  Package,
  PlusCircle,
  Settings,
  ShieldCheck,
  ShoppingCart,
  User,
  Users,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { applyPpeRequestUserFilter } from '@/lib/ppeRequests';
import { isAdminRole } from '@/lib/roles';
import { clearOneSignalUser, requestOneSignalPermission } from '@/lib/onesignalClient';
import { toast } from 'sonner';

type CrewActionItem = {
  id: string;
  status: string;
  title: string;
  description: string;
  href?: string;
};

type AdminActionItem = {
  id: string;
  href: string;
  title: string;
  description: string;
  meta: string;
  countLabel?: string;
  tone: 'amber' | 'red' | 'violet';
  icon: typeof Clock;
};

type SeenCrewRequestStatuses = Record<string, string>;

function getCrewNotificationStorageKey(user: { id?: string; full_name?: string } | null) {
  const identity = user?.id || user?.full_name || 'anonymous';
  return `kmt_crew_request_statuses_${identity}`;
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [notifData, setNotifData] = useState<any>({
    pending: 0,
    lowStock: 0,
    expiredCerts: 0,
    adminActions: [] as AdminActionItem[],
    personalUpdates: [] as CrewActionItem[],
    personalCertActions: [] as CrewActionItem[],
    updates: [] as CrewActionItem[],
    approvedCount: 0,
    personalApprovedCount: 0,
    personalCertAlertCount: 0,
  });
  const [unreadCount, setUnreadCount] = useState(0);

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const isAdmin = isAdminRole(user?.position);

  const playNotificationSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.001, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.06, audioContext.currentTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch {
      // Ignore browsers that block autoplay audio.
    }
  };

  const showBrowserNotification = (title: string, body: string) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    new Notification(title, {
      body,
      silent: false,
    });
  };

  const menuItems = useMemo(
    () =>
      isAdmin
        ? [
            { name: 'APPROVALS', href: '/admin/approvals', icon: ClipboardCheck },
            { name: 'HISTORY', href: '/admin/history', icon: History },
            { name: 'INVENTORY', href: '/admin/inventory', icon: Package },
            { name: 'CERTIFICATE', href: '/certificates', icon: FileBadge },
            { name: 'REQUEST PPE', href: '/ppe', icon: PlusCircle },
          ]
        : [
            { name: 'CERTIFICATE', href: '/certificates', icon: FileBadge },
            { name: 'REQUEST PPE', href: '/ppe', icon: PlusCircle },
            { name: 'MY HISTORY', href: '/my-requests', icon: History },
          ],
    [isAdmin],
  );

  useEffect(() => {
    setMounted(true);
    const storedUser = localStorage.getItem('kmt_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      setUser(null);
    }
  }, [pathname]);

  useEffect(() => {
    if (!user?.id) return;

    const fetchNotifications = async () => {
      let currentTotal = 0;

      if (isAdmin) {
        const personalCountQuery = await applyPpeRequestUserFilter(
          supabase.from('ppe_requests').select('*', { count: 'exact', head: true }).in('status', ['approved', 'rejected']),
          user,
        );

        const personalUpdatesQuery = await applyPpeRequestUserFilter(
          supabase
            .from('ppe_requests')
            .select('id, created_at, status, admin_remark, rejection_reason, reason, items')
            .in('status', ['approved', 'rejected'])
            .order('created_at', { ascending: false })
            .limit(6),
          user,
        );

        const [pendingRes, pendingRowsRes, invRes, certsRes, personalCountRes, personalUpdatesRes] = await Promise.all([
          supabase.from('ppe_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase
            .from('ppe_requests')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(5),
          supabase.from('ppe_inventory').select('quantity, threshold'),
          supabase.from('crew_certs').select('expiry_date'),
          personalCountQuery,
          personalUpdatesQuery,
        ]);

        const lowStock = invRes.data?.filter((item: any) => (item.quantity || 0) <= (item.threshold || 0)).length || 0;
        const expired =
          certsRes.data?.filter(
            (cert: any) => new Date(cert.expiry_date) < new Date() && cert.expiry_date !== '2099-12-31',
          ).length || 0;
        const pendingCount = pendingRes.count || 0;
        const pendingRows = pendingRowsRes.data || [];
        const personalRows = personalUpdatesRes.data || [];

        const pendingActions: AdminActionItem[] = pendingRows.map((req: any) => {
          const crewName = req.crew_name || req.requester_name || req.full_name || 'Unknown crew';
          const firstItem = req.items?.[0]?.item_name || 'PPE request';
          const itemCount = req.items?.length || 0;
          const moreLabel = itemCount > 1 ? ` +${itemCount - 1} more` : '';
          return {
            id: `pending-${req.id}`,
            href: `/admin/approvals?request=${req.id}`,
            title: `${crewName} sent a PPE request`,
            description: `${firstItem}${moreLabel}`,
            meta: new Date(req.created_at).toLocaleString('en-GB'),
            countLabel: 'NEW',
            tone: 'amber',
            icon: Clock,
          };
        });

        const personalUpdates: CrewActionItem[] = personalRows.map((req: any) => {
          const itemName = req.items?.[0]?.item_name || 'PPE request';
          const approved = req.status === 'approved';
          return {
            id: req.id,
            status: req.status,
            title: approved ? 'Approved and ready to receive' : 'Request rejected',
            description: approved
              ? `${itemName} is waiting for your confirmation`
              : req.admin_remark || req.rejection_reason || `${itemName} needs your attention`,
          };
        });
        const personalApprovedCount = personalRows.filter((req: any) => req.status === 'approved').length;
        const personalUpdateCount = personalCountRes.count || 0;

        const myUploadedCerts = (certsRes.data || []).filter((cert: any) => String(cert.crew_id || '') === String(user.id || ''));
        const now = new Date();
        const personalCertActions: CrewActionItem[] = myUploadedCerts
          .map((cert: any) => {
            const expiry = cert.expiry_date ? new Date(cert.expiry_date) : null;
            if (!expiry || cert.expiry_date === '2099-12-31') return null;
            const daysLeft = Math.floor((expiry.getTime() - now.getTime()) / 86400000);
            if (daysLeft < 0) {
              return {
                id: `my-cert-expired-${cert.id}`,
                status: 'expired-cert',
                title: 'My certificate expired',
                description: `${cert.cert_name || 'Certificate'} expired and needs renewal`,
                href: '/certificates?tab=personal&personal=expired',
              };
            }
            if (daysLeft <= 90) {
              return {
                id: `my-cert-warning-${cert.id}`,
                status: 'warning-cert',
                title: 'My certificate expires soon',
                description: `${cert.cert_name || 'Certificate'} expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
                href: '/certificates?tab=personal&personal=warning',
              };
            }
            return null;
          })
          .filter(Boolean)
          .slice(0, 4) as CrewActionItem[];
        const personalCertAlertCount = personalCertActions.length;

        const systemActions: AdminActionItem[] = [];
        if (lowStock > 0) {
          systemActions.push({
            id: 'low-stock',
            href: '/admin/inventory?filter=low',
            title: 'Low stock needs attention',
            description: 'Critical inventory lines are below threshold',
            meta: `${lowStock} item${lowStock > 1 ? 's' : ''} affected`,
            countLabel: String(lowStock),
            tone: 'red',
            icon: AlertTriangle,
          });
        }
        if (expired > 0) {
          systemActions.push({
            id: 'expired-certs',
            href: '/certificates?tab=crew&filter=action',
            title: 'Expired certificates need follow-up',
            description: 'Crew compliance issues require review',
            meta: `${expired} certificate${expired > 1 ? 's' : ''} expired`,
            countLabel: String(expired),
            tone: 'violet',
            icon: Users,
          });
        }

        setNotifData({
          pending: pendingCount,
          lowStock,
          expiredCerts: expired,
          pendingActions,
          adminActions: systemActions,
          personalUpdates,
          personalCertActions,
          updates: [],
          approvedCount: 0,
          personalApprovedCount,
          personalCertAlertCount,
        });
        currentTotal = pendingCount + lowStock + expired + personalUpdateCount + personalCertAlertCount;
      } else {
        const countQuery = await applyPpeRequestUserFilter(
          supabase.from('ppe_requests').select('*', { count: 'exact', head: true }).in('status', ['approved', 'rejected']),
          user,
        );

        const updatesQuery = await applyPpeRequestUserFilter(
          supabase
            .from('ppe_requests')
            .select('id, created_at, status, admin_remark, rejection_reason, reason, items')
            .in('status', ['approved', 'rejected'])
            .order('created_at', { ascending: false })
            .limit(6),
          user,
        );

        const [myCertsRes, { count }, { data: updates }] = await Promise.all([
          supabase.from('crew_certs').select('id, cert_name, expiry_date').eq('crew_id', user.id),
          countQuery,
          updatesQuery,
        ]);
        const rows = updates || [];
        const statusStorageKey = getCrewNotificationStorageKey(user);
        const previousStatuses = JSON.parse(
          localStorage.getItem(statusStorageKey) || '{}',
        ) as SeenCrewRequestStatuses;
        const nextStatuses: SeenCrewRequestStatuses = {};
        let hasNewCrewAction = false;
        const actionItems: CrewActionItem[] = rows.map((req: any) => {
          const itemName = req.items?.[0]?.item_name || 'PPE request';
          const approved = req.status === 'approved';
          nextStatuses[String(req.id)] = String(req.status || '');
          return {
            id: req.id,
            status: req.status,
            title: approved ? 'Approved and ready to receive' : 'Request rejected',
            description: approved
              ? `${itemName} is waiting for your confirmation`
              : req.admin_remark || req.rejection_reason || `${itemName} needs your attention`,
          };
        });

        const approvedCount = rows.filter((req: any) => req.status === 'approved').length;
        const now = new Date();
        const personalCertActions: CrewActionItem[] = (myCertsRes.data || [])
          .map((cert: any) => {
            const expiry = cert.expiry_date ? new Date(cert.expiry_date) : null;
            if (!expiry || cert.expiry_date === '2099-12-31') return null;
            const daysLeft = Math.floor((expiry.getTime() - now.getTime()) / 86400000);
            if (daysLeft < 0) {
              return {
                id: `my-cert-expired-${cert.id}`,
                status: 'expired-cert',
                title: 'My certificate expired',
                description: `${cert.cert_name || 'Certificate'} expired and needs renewal`,
                href: '/certificates?tab=personal&personal=expired',
              };
            }
            if (daysLeft <= 90) {
              return {
                id: `my-cert-warning-${cert.id}`,
                status: 'warning-cert',
                title: 'My certificate expires soon',
                description: `${cert.cert_name || 'Certificate'} expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
                href: '/certificates?tab=personal&personal=warning',
              };
            }
            return null;
          })
          .filter(Boolean)
          .slice(0, 4) as CrewActionItem[];
        const personalCertAlertCount = personalCertActions.length;

        if (Object.keys(previousStatuses).length > 0) {
          const newlyApproved = rows.filter(
            (req: any) => req.status === 'approved' && previousStatuses[String(req.id)] !== 'approved',
          );
          const newlyRejected = rows.filter(
            (req: any) => req.status === 'rejected' && previousStatuses[String(req.id)] !== 'rejected',
          );

          if (newlyApproved.length > 0) {
            hasNewCrewAction = true;
            const firstItem = newlyApproved[0]?.items?.[0]?.item_name || 'PPE request';
            const moreLabel = newlyApproved.length > 1 ? ` and ${newlyApproved.length - 1} more` : '';
            toast.success('Request Approved!', {
              icon: <CheckCircle2 className="text-emerald-500" />,
              description: `${firstItem}${moreLabel} is ready for you to receive in My Requests.`,
              duration: 10000,
            });
            playNotificationSound();
            showBrowserNotification(
              'Request Approved',
              `${firstItem}${moreLabel} is ready for you to confirm receipt in My Requests.`,
            );
          }

          if (newlyRejected.length > 0) {
            hasNewCrewAction = true;
            const firstItem = newlyRejected[0]?.items?.[0]?.item_name || 'PPE request';
            toast.error('Request Rejected', {
              icon: <XCircle className="text-red-500" />,
              description: `${firstItem} needs your attention. Check My Requests for details.`,
              duration: 10000,
            });
            playNotificationSound();
            showBrowserNotification('Request Rejected', `${firstItem} needs your attention in My Requests.`);
          }
        }

        localStorage.setItem(statusStorageKey, JSON.stringify(nextStatuses));
        if (hasNewCrewAction) {
          window.dispatchEvent(new Event('new-notification'));
        }

        setNotifData({
          pending: count || 0,
          lowStock: 0,
          expiredCerts: 0,
          personalCertActions,
          updates: actionItems,
          approvedCount,
          personalCertAlertCount,
        });
        currentTotal = (count || 0) + personalCertAlertCount;
      }

      const lastSeenTotal = parseInt(localStorage.getItem('kmt_notif_seen') || '0');
      const unread = currentTotal > lastSeenTotal ? currentTotal - lastSeenTotal : 0;
      setUnreadCount(unread);
    };

    fetchNotifications();
    const handleNewNotif = () => fetchNotifications();
    const handleFocus = () => fetchNotifications();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchNotifications();
      }
    };
    const interval = window.setInterval(fetchNotifications, 15000);
    window.addEventListener('new-notification', handleNewNotif);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('new-notification', handleNewNotif);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user, isAdmin, pathname]);

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

  const handleOpenNotif = () => {
    const isOpening = !showNotif;
    setShowNotif(isOpening);
    setShowProfile(false);

    if (isOpening) {
      requestOneSignalPermission();
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => undefined);
      }
    }

    if (isOpening) {
      const total =
        notifData.pending + notifData.lowStock + notifData.expiredCerts + (notifData.personalCertAlertCount || 0);
      localStorage.setItem('kmt_notif_seen', total.toString());
      setUnreadCount(0);
    }
  };

  const totalPersonalAdminUpdates = (notifData.personalUpdates || []).length;

  if (!mounted || ['/login', '/register'].includes(pathname)) return null;

  return (
    <>
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

                      {(notifData.adminActions || []).length > 0 && (
                        <div className="px-1 pt-3">
                          <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                            System Alerts
                          </p>
                        </div>
                      )}

                      {(notifData.adminActions || []).map((item: AdminActionItem) => {
                        const Icon = item.icon;
                        const toneClassName =
                          item.tone === 'amber'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/20'
                            : item.tone === 'red'
                              ? 'bg-red-500/15 text-red-300 border-red-500/20'
                              : 'bg-violet-500/15 text-violet-300 border-violet-500/20';

                        const badgeClassName =
                          item.tone === 'amber'
                            ? 'bg-amber-400 text-black'
                            : item.tone === 'red'
                              ? 'bg-red-500 text-white'
                              : 'bg-violet-500 text-white';

                        return (
                          <Link
                            key={item.id}
                            href={item.href}
                            onClick={() => setShowNotif(false)}
                            className="flex items-center justify-between gap-3 p-4 hover:bg-white/5 rounded-2xl transition-all group border border-white/5"
                          >
                            <div className="flex items-center gap-4 min-w-0">
                              <div className={`p-2 rounded-xl border ${toneClassName}`}>
                                <Icon size={16} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-white uppercase truncate">{item.title}</p>
                                <p className="text-[9px] text-zinc-500 mt-1 normal-case">{item.description}</p>
                                <p className="text-[9px] text-orange-400 mt-2 normal-case font-black">{item.meta}</p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2 shrink-0">
                              {item.countLabel && (
                                <span className={`px-2 py-1 rounded-md text-[9px] font-black ${badgeClassName}`}>
                                  {item.countLabel}
                                </span>
                              )}
                              <ArrowRight size={14} className="text-zinc-600 group-hover:text-orange-400" />
                            </div>
                          </Link>
                        );
                      })}
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
                setShowProfile(!showProfile);
                setShowNotif(false);
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
              <div className="absolute right-0 top-12 w-64 bg-zinc-900 border border-orange-500/20 rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 z-[110]">
                <div className="p-6 bg-black/40 border-b border-white/5">
                  <p className="text-white font-bold text-sm truncate">{user?.full_name}</p>
                  <p className="text-orange-500 text-[10px] font-black uppercase mt-1 tracking-widest">{user?.position}</p>
                  <p className="mt-2 text-[9px] text-cyan-400 normal-case">
                    role-debug: {String(user?.position || '')} | admin={String(isAdmin)}
                  </p>
                </div>
                <div className="p-2 space-y-1">
                  {isAdmin && (
                    <Link
                      href="/admin/settings"
                      onClick={() => setShowProfile(false)}
                      className="w-full flex items-center gap-3 px-4 py-4 text-xs font-bold text-zinc-400 hover:text-white hover:bg-orange-600/10 rounded-2xl transition-all uppercase tracking-widest"
                    >
                      <Settings size={16} /> Admin Panel
                    </Link>
                  )}
                  <button
                    onClick={() => {
                      clearOneSignalUser();
                      localStorage.removeItem('kmt_user');
                      router.push('/login');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-4 text-xs text-red-400 font-black uppercase tracking-widest hover:bg-red-500/10 rounded-2xl transition-all text-left"
                  >
                    <LogOut size={16} /> Logout
                  </button>
                </div>
              </div>
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
                {item.name.replace('REQUEST PPE', 'REQUEST').replace('CERTIFICATE', 'CERT').replace('APPROVALS', 'APPROVE')}
              </span>
              {isActive && <div className="absolute bottom-1 w-5 h-0.5 bg-orange-500 rounded-full shadow-[0_0_10px_#f97316]"></div>}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
