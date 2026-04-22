"use client";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, Package, ShieldCheck, Bell, LogOut, 
  ClipboardCheck, ShoppingCart, User, Settings, History, PlusCircle, FileBadge 
} from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  const profileRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async (u: any) => {
    if (!u?.id) return;
    const role = (u.position || "").toLowerCase();
    const isAdmin = ["safety officer", "chief officer", "barge master"].includes(role);
    // แอดมินนับรายการรออนุมัติ / ลูกเรือนับรายการที่อนุมัติแล้วรอรับ
    const { count } = await supabase.from('ppe_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', isAdmin ? 'pending' : 'approved')
      .filter('crew_id', isAdmin ? 'neq' : 'eq', u.id); // ถ้าเป็นลูกเรือนับแค่ของตัวเอง
    setNotifCount(count || 0);
  };

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
    };
    document.addEventListener("mousedown", handleClickOutside);
    
    return () => {
      window.removeEventListener('cart-updated', handleCartUpdate);
      window.removeEventListener('new-notification', handleNewNotif);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [pathname]);

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
      {/* --- Floating Top Navbar (Desktop) --- */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 w-[94%] max-w-6xl h-14 bg-black/80 backdrop-blur-xl border border-orange-500/20 rounded-2xl z-[100] px-4 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-6">
          {/* Logo click returns to dashboard */}
          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => router.push(isAdmin ? '/admin/dashboard' : '/dashboard')}>
            <ShieldCheck size={22} className="text-orange-500 transition-transform group-hover:scale-110" />
            <span className="font-black text-lg tracking-tighter text-white uppercase italic">KMT</span>
          </div>
          <div className="hidden md:flex items-center gap-1">
            {menuItems.map((item) => (
              <Link key={item.href} href={item.href} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${pathname === item.href ? 'text-white bg-orange-600 shadow-lg shadow-orange-600/20' : 'text-zinc-500 hover:text-orange-400'}`}>{item.name}</Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2" ref={profileRef}>
          {/* Shopping Cart */}
          <button onClick={() => window.dispatchEvent(new CustomEvent('open-cart'))} className="p-2.5 text-zinc-500 hover:text-orange-500 relative transition-colors">
            <ShoppingCart size={18} />
            {cartCount > 0 && <span className="absolute top-1 right-1 w-4 h-4 bg-orange-600 text-white text-[8px] font-black rounded-full flex items-center justify-center border border-black">{cartCount}</span>}
          </button>

          {/* 🔔 Notification Bell (Restored) */}
          <Link href={isAdmin ? "/admin/approvals" : "/my-requests"} className="p-2.5 text-zinc-500 hover:text-orange-500 relative transition-colors">
            <Bell size={18} />
            {notifCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-600 text-white text-[8px] font-black rounded-full flex items-center justify-center border border-black animate-bounce shadow-lg shadow-red-600/20">
                {notifCount}
              </span>
            )}
          </Link>

          {/* Profile Trigger */}
          <button onClick={() => setShowProfile(!showProfile)} className={`ml-2 w-9 h-9 flex items-center justify-center rounded-xl border transition-all ${showProfile ? 'bg-orange-600 border-orange-400 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]' : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'}`}>
            <User size={18} />
          </button>
          
          {showProfile && (
            <div className="absolute right-0 top-12 w-64 bg-zinc-900 border border-orange-500/20 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 z-[110]">
              <div className="p-5 bg-black/40 border-b border-white/5">
                <p className="text-white font-bold text-sm truncate">{user?.full_name}</p>
                <p className="text-orange-500 text-[10px] font-black uppercase mt-1 tracking-widest">{user?.position}</p>
              </div>
              <div className="p-2 space-y-1">
                {isAdmin && (<Link href="/admin/settings" onClick={() => setShowProfile(false)} className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-zinc-400 hover:text-white hover:bg-orange-600/10 rounded-xl transition-all uppercase tracking-widest"><Settings size={16} /> Admin Panel</Link>)}
                <button onClick={() => { localStorage.removeItem('kmt_user'); router.push('/login'); }} className="w-full flex items-center gap-3 px-4 py-3 text-xs text-red-400 font-black uppercase tracking-widest hover:bg-red-500/10 rounded-xl transition-all text-left"><LogOut size={16} /> Logout</button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* --- Mobile Bottom Navigation --- */}
      <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] h-16 bg-black/90 backdrop-blur-2xl border border-orange-500/20 rounded-3xl z-[100] px-2 shadow-2xl flex items-center justify-around">
          <Link href={isAdmin ? '/admin/dashboard' : '/dashboard'} className={`flex flex-col items-center gap-1 ${pathname.includes('dashboard') ? 'text-orange-500' : 'text-zinc-500'}`}><LayoutDashboard size={20} /><span className="text-[8px] font-bold uppercase tracking-tighter">Home</span></Link>
          {menuItems.slice(0, 4).map((item) => {
            const Icon = item.icon; const isActive = pathname === item.href;
            return ( <Link key={item.href} href={item.href} className={`flex flex-col items-center gap-1 ${isActive ? 'text-orange-500' : 'text-zinc-500'}`}><Icon size={20} /><span className="text-[8px] font-bold uppercase tracking-tighter">{item.name}</span></Link> );
          })}
      </nav>
    </>
  );
}
