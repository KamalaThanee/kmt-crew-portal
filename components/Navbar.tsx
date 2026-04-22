"use client";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Package, ShieldCheck, Bell, LogOut, ClipboardCheck, ShoppingCart, User, Settings, History, PlusCircle, FileBadge, AlertTriangle, Clock, Users } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [notifData, setNotifData] = useState<any>({ pending: 0, lowStock: 0, expiredCerts: 0 });
  const [unreadCount, setUnreadCount] = useState(0); // 🎯 ตัวเลขนับเฉพาะที่ยังไม่ได้อ่าน
  
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const storedUser = localStorage.getItem('kmt_user');
    if (storedUser) {
      const u = JSON.parse(storedUser);
      setUser(u);
      fetchNotifications(u);
    }
    const handleCartUpdate = (e: any) => setCartCount(e.detail);
    const handleNewNotif = () => fetchNotifications(JSON.parse(localStorage.getItem('kmt_user') || '{}'));
    
    window.addEventListener('cart-updated', handleCartUpdate);
    window.addEventListener('new-notification', handleNewNotif);
    
    const handleClickOutside = (e: MouseEvent) => { 
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false); 
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false); 
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener('cart-updated', handleCartUpdate);
      window.removeEventListener('new-notification', handleNewNotif);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [pathname]);

  const fetchNotifications = async (u: any) => {
    if (!u?.id) return;
    const role = (u.position || "").toLowerCase();
    const isAdmin = ["safety officer", "chief officer", "barge master"].includes(role);
    
    let currentTotal = 0;

    if (isAdmin) {
      const [pendingRes, invRes, certsRes] = await Promise.all([
        supabase.from('ppe_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('ppe_inventory').select('quantity, threshold'),
        supabase.from('crew_certs').select('expiry_date')
      ]);
      const lowStock = invRes.data?.filter(i => (i.quantity||0) <= (i.threshold||0)).length || 0;
      const expired = certsRes.data?.filter(c => new Date(c.expiry_date) < new Date() && c.expiry_date !== '2099-12-31').length || 0;
      const pendingCount = pendingRes.count || 0;
      
      setNotifData({ pending: pendingCount, lowStock, expiredCerts: expired });
      currentTotal = pendingCount + lowStock + expired;
    } else {
      const { count } = await supabase.from('ppe_requests').select('*', { count: 'exact', head: true }).eq('crew_id', u.id).in('status', ['approved', 'rejected']);
      setNotifData({ pending: count || 0, lowStock: 0, expiredCerts: 0 });
      currentTotal = count || 0;
    }

    // 🎯 คำนวณ Unread: เอา Total ปัจจุบัน ลบกับตัวเลขที่เคยเซฟไว้ตอนเปิดดูครั้งสุดท้าย
    const lastSeenTotal = parseInt(localStorage.getItem('kmt_notif_seen') || '0');
    // ถ้ามีปัญหาใหม่เพิ่มขึ้น (Total ปัจจุบัน > ที่เคยดู) ให้โชว์เฉพาะส่วนต่างที่งอกมา
    const unread = currentTotal > lastSeenTotal ? currentTotal - lastSeenTotal : 0;
    setUnreadCount(unread);
  };

  // 🎯 เมื่อผู้ใช้กดดูกระดิ่ง ให้เคลียร์เลขสีแดงและจำยอดปัจจุบันไว้ (Mark as read)
  const handleOpenNotif = () => {
    const isOpening = !showNotif;
    setShowNotif(isOpening);
    setShowProfile(false);

    if (isOpening) {
      const total = notifData.pending + notifData.lowStock + notifData.expiredCerts;
      localStorage.setItem('kmt_notif_seen', total.toString());
      setUnreadCount(0); // ลบป้ายแดงทันที
    }
  };

  if (!mounted || ['/login', '/register'].includes(pathname)) return null;

  const role = (user?.position || "").toLowerCase();
  const isAdmin = ["safety officer", "chief officer", "barge master"].includes(role);
  
  const menuItems = isAdmin ? [
    { name: 'APPROVALS', href: '/admin/approvals', icon: ClipboardCheck },
    { name: 'INVENTORY', href: '/admin/inventory', icon: Package },
    { name: 'CERTIFICATE', href: '/certificates', icon: FileBadge },
    { name: 'REQUEST PPE', href: '/ppe', icon: PlusCircle },
  ] : [
    { name: 'CERTIFICATE', href: '/certificates', icon: FileBadge },
    { name: 'REQUEST PPE', href: '/ppe', icon: PlusCircle },
    { name: 'MY HISTORY', href: '/my-requests', icon: History },
  ];

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
              <Link key={item.href} href={item.href} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${pathname === item.href ? 'text-white bg-orange-600 shadow-lg shadow-orange-600/20' : 'text-zinc-500 hover:text-orange-400'}`}>{item.name}</Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => window.dispatchEvent(new CustomEvent('open-cart'))} className="p-2.5 text-zinc-500 hover:text-orange-500 relative transition-colors"><ShoppingCart size={18} />{cartCount > 0 && <span className="absolute top-1 right-1 w-4 h-4 bg-orange-600 text-white text-[8px] font-black rounded-full flex items-center justify-center border border-black">{cartCount}</span>}</button>
          
          <div className="relative" ref={notifRef}>
            <button onClick={handleOpenNotif} className="p-2.5 text-zinc-500 hover:text-orange-500 relative transition-colors">
              <Bell size={18} />
              {/* 🎯 แสดงเฉพาะ Unread Count */}
              {unreadCount > 0 && <span className="absolute top-1 right-1 w-4 h-4 bg-red-600 text-white text-[8px] font-black rounded-full flex items-center justify-center border border-black animate-pulse">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </button>
            {showNotif && (
              <div className="absolute right-0 top-12 w-80 bg-zinc-900 border border-white/10 rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 z-[110]">
                <div className="p-5 bg-black/40 border-b border-white/5"><h3 className="text-white font-black italic uppercase text-lg">Notifications</h3><p className="text-orange-500 text-[10px] font-bold tracking-widest mt-1">Action Center</p></div>
                <div className="p-2 space-y-1 bg-black/20">
                  {isAdmin ? (
                    <>
                      <Link href="/admin/approvals" onClick={() => setShowNotif(false)} className="flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-all group">
                        <div className="flex items-center gap-4"><div className={`p-2 rounded-xl ${notifData.pending > 0 ? 'bg-amber-500/20 text-amber-500' : 'bg-white/5 text-zinc-500'}`}><Clock size={16}/></div><div><p className="text-xs font-bold text-white uppercase">Pending PPE</p><p className="text-[9px] text-zinc-500 mt-1">Needs Approval</p></div></div>
                        {notifData.pending > 0 && <span className="bg-amber-500 text-black px-2 py-1 rounded-md text-[9px] font-black">{notifData.pending}</span>}
                      </Link>
                      <Link href="/admin/inventory?filter=low" onClick={() => setShowNotif(false)} className="flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-all group border-t border-white/5">
                        <div className="flex items-center gap-4"><div className={`p-2 rounded-xl ${notifData.lowStock > 0 ? 'bg-red-500/20 text-red-500' : 'bg-white/5 text-zinc-500'}`}><AlertTriangle size={16}/></div><div><p className="text-xs font-bold text-white uppercase">Low Stock Alerts</p><p className="text-[9px] text-zinc-500 mt-1">Inventory Management</p></div></div>
                        {notifData.lowStock > 0 && <span className="bg-red-500 text-white px-2 py-1 rounded-md text-[9px] font-black animate-pulse">{notifData.lowStock}</span>}
                      </Link>
                      <Link href="/admin/settings?tab=crews" onClick={() => setShowNotif(false)} className="flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-all group border-t border-white/5">
                        <div className="flex items-center gap-4"><div className={`p-2 rounded-xl ${notifData.expiredCerts > 0 ? 'bg-purple-500/20 text-purple-500' : 'bg-white/5 text-zinc-500'}`}><Users size={16}/></div><div><p className="text-xs font-bold text-white uppercase">Expired Certificates</p><p className="text-[9px] text-zinc-500 mt-1">Crew Compliance</p></div></div>
                        {notifData.expiredCerts > 0 && <span className="bg-purple-500 text-white px-2 py-1 rounded-md text-[9px] font-black">{notifData.expiredCerts}</span>}
                      </Link>
                    </>
                  ) : (
                    <Link href="/my-requests" onClick={() => setShowNotif(false)} className="flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-all group">
                      <div className="flex items-center gap-4"><div className={`p-2 rounded-xl ${notifData.pending > 0 ? 'bg-emerald-500/20 text-emerald-500' : 'bg-white/5 text-zinc-500'}`}><ClipboardCheck size={16}/></div><div><p className="text-xs font-bold text-white uppercase">PPE Updates</p><p className="text-[9px] text-zinc-500 mt-1">Check Your History</p></div></div>
                      {notifData.pending > 0 && <span className="bg-emerald-500 text-black px-2 py-1 rounded-md text-[9px] font-black">{notifData.pending} NEW</span>}
                    </Link>
                  )}
                  {notifData.pending + notifData.lowStock + notifData.expiredCerts === 0 && <div className="text-center p-6 text-zinc-600 text-[10px] uppercase font-black tracking-widest">No Alerts</div>}
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={profileRef}>
            <button onClick={() => { setShowProfile(!showProfile); setShowNotif(false); }} className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all ${showProfile ? 'bg-orange-600 border-orange-400 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]' : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'}`}><User size={18} /></button>
            {showProfile && (
              <div className="absolute right-0 top-12 w-64 bg-zinc-900 border border-orange-500/20 rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 z-[110]">
                <div className="p-6 bg-black/40 border-b border-white/5"><p className="text-white font-bold text-sm truncate">{user?.full_name}</p><p className="text-orange-500 text-[10px] font-black uppercase mt-1 tracking-widest">{user?.position}</p></div>
                <div className="p-2 space-y-1">
                  {isAdmin && (<Link href="/admin/settings" onClick={() => setShowProfile(false)} className="w-full flex items-center gap-3 px-4 py-4 text-xs font-bold text-zinc-400 hover:text-white hover:bg-orange-600/10 rounded-2xl transition-all uppercase tracking-widest"><Settings size={16} /> Admin Panel</Link>)}
                  <button onClick={() => { localStorage.removeItem('kmt_user'); router.push('/login'); }} className="w-full flex items-center gap-3 px-4 py-4 text-xs text-red-400 font-black uppercase tracking-widest hover:bg-red-500/10 rounded-2xl transition-all text-left"><LogOut size={16} /> Logout</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Nav */}
      <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] h-16 bg-black/90 backdrop-blur-2xl border border-orange-500/20 rounded-3xl z-[100] px-2 shadow-2xl flex items-center justify-around">
          {menuItems.slice(0, 4).map((item) => {
            const Icon = item.icon; const isActive = pathname === item.href;
            return ( <Link key={item.href} href={item.href} className={`flex flex-col items-center justify-center gap-1 w-full h-full relative transition-all ${isActive ? 'text-orange-500' : 'text-zinc-500'}`}><Icon size={22} strokeWidth={isActive ? 2.5 : 2} /><span className="text-[8px] font-black uppercase tracking-tighter">{item.name.replace('REQUEST PPE', 'REQUEST')}</span>{isActive && <div className="absolute bottom-1 w-5 h-0.5 bg-orange-500 rounded-full shadow-[0_0_10px_#f97316]"></div>}</Link> );
          })}
      </nav>
    </>
  );
}
