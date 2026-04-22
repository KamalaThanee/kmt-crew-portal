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
    if (!u) return;
    const role = (u.position || "").toLowerCase();
    const isAdmin = ["safety officer", "chief officer", "barge master"].includes(role);
    
    // ถ้าเป็น Admin นับรายการ Pending, ถ้าเป็นลูกเรือนับรายการที่ Approved แล้วยังไม่ได้รับ
    if (isAdmin) {
      const { count } = await supabase.from('ppe_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending');
      setNotifCount(count || 0);
    } else {
      const { count } = await supabase.from('ppe_requests').select('*', { count: 'exact', head: true }).eq('crew_id', u.id).eq('status', 'approved');
      setNotifCount(count || 0);
    }
  };

  useEffect(() => {
    setMounted(true);
    const storedUser = localStorage.getItem('kmt_user');
    if (storedUser) {
      const u = JSON.parse(storedUser);
      setUser(u);
      fetchNotifications(u);
    }

    // ฟัง Event เมื่อมีแจ้งเตือนใหม่จาก RealtimeListener
    const handleNewNotif = () => {
      const u = JSON.parse(localStorage.getItem('kmt_user') || '{}');
      fetchNotifications(u);
    };

    const handleCartUpdate = (e: any) => setCartCount(e.detail);
    
    window.addEventListener('cart-updated', handleCartUpdate);
    window.addEventListener('new-notification', handleNewNotif);
    
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setShowProfile(false);
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
    { name: 'DASHBOARD', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'APPROVALS', href: '/admin/approvals', icon: ClipboardCheck },
    { name: 'INVENTORY', href: '/admin/inventory', icon: Package },
    { name: 'CERTIFICATE', href: '/certificates', icon: FileBadge },
    { name: 'REQUEST PPE', href: '/ppe', icon: PlusCircle },
  ] : [
    { name: 'DASHBOARD', href: '/dashboard', icon: LayoutDashboard },
    { name: 'CERTIFICATE', href: '/certificates', icon: FileBadge },
    { name: 'REQUEST PPE', href: '/ppe', icon: PlusCircle },
    { name: 'MY HISTORY', href: '/my-requests', icon: History },
  ];

  return (
    <>
      <nav className="fixed top-0 w-full h-14 md:h-16 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 px-4 md:px-6 flex items-center justify-between z-[60]">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2 font-black text-blue-500 text-xl md:text-2xl tracking-tighter cursor-pointer" onClick={() => router.push(menuItems[0].href)}>
            <ShieldCheck size={28} className="text-blue-600" /> KMT
          </div>
          <div className="hidden md:flex items-center gap-1 font-black text-[10px] tracking-[0.2em]">
            {menuItems.map((item) => (
              <Link key={item.href} href={item.href} className={`px-4 py-2 rounded-lg border transition-all ${pathname === item.href ? 'bg-blue-600/10 text-blue-400 border-blue-500/20' : 'text-slate-400 border-transparent hover:text-slate-200'}`}>{item.name}</Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3 relative" ref={profileRef}>
          {/* Cart Icon */}
          <button onClick={() => window.dispatchEvent(new CustomEvent('open-cart'))} className="relative p-2.5 text-slate-400 hover:text-white bg-white/5 rounded-full border border-white/5 transition-colors">
            <ShoppingCart size={18} />
            {cartCount > 0 && <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] flex items-center justify-center bg-blue-600 text-white text-[8px] font-black rounded-full border-2 border-slate-950 px-1">{cartCount}</span>}
          </button>

          {/* 🔔 กระดิ่งแจ้งเตือนกลับมาแล้ว */}
          <Link href={isAdmin ? "/admin/approvals" : "/my-requests"} className="relative p-2.5 text-slate-400 hover:text-white bg-white/5 rounded-full border border-white/5 transition-colors">
            <Bell size={18} />
            {notifCount > 0 && <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] flex items-center justify-center bg-red-500 text-white text-[8px] font-black rounded-full border-2 border-slate-950 px-1 animate-bounce">{notifCount}</span>}
          </Link>

          {/* Profile Icon */}
          <button onClick={() => setShowProfile(!showProfile)} className={`w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-full border transition-all ${showProfile ? 'bg-blue-600 text-white border-blue-400' : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'}`}>
            <User size={18} />
          </button>
          
          {showProfile && (
            <div className="absolute right-0 top-14 w-64 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[70] animate-in fade-in zoom-in duration-200">
              <div className="p-5 bg-slate-800/50 border-b border-white/5">
                <p className="text-white font-bold text-sm truncate">{user?.full_name}</p>
                <p className="text-blue-400 text-[10px] font-black uppercase mt-1 tracking-widest">{user?.position}</p>
              </div>
              <div className="p-2 space-y-1">
                {isAdmin && (<Link href="/admin/settings" onClick={() => setShowProfile(false)} className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-slate-300 hover:bg-white/5 rounded-xl transition-colors uppercase tracking-widest"><Settings size={16} /> Admin Panel</Link>)}
                <button onClick={() => { localStorage.removeItem('kmt_user'); router.push('/login'); }} className="w-full flex items-center gap-3 px-4 py-3 text-xs text-red-400 font-black uppercase tracking-widest hover:bg-red-500/10 rounded-xl transition-colors"><LogOut size={16} /> Logout</button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* BOTTOM NAV (Mobile Only) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950/90 backdrop-blur-xl border-t border-white/10 z-[60] h-16">
        <div className="flex items-center justify-around h-full">
          {menuItems.slice(0, 5).map((item) => {
            const Icon = item.icon; const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className={`flex flex-col items-center justify-center gap-1 w-full h-full relative transition-colors ${isActive ? 'text-blue-500' : 'text-slate-500'}`}>
                <Icon size={20} /><span className="text-[8px] font-black uppercase tracking-tighter">{item.name}</span>
                {isActive && <div className="absolute bottom-1 w-5 h-0.5 bg-blue-500 rounded-full shadow-[0_0_10px_#3b82f6]"></div>}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
