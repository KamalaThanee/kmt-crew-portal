"use client";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Package, ShieldCheck, Bell, LogOut, ClipboardList } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    setMounted(true);
    const storedUser = localStorage.getItem('kmt_user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      
      const role = parsedUser.rank || parsedUser.position || "";
      if (["Safety Officer", "Chief Officer", "Barge Master"].includes(role)) {
        fetchPendingCount();
      }
    }
  }, [pathname]);

  const fetchPendingCount = async () => {
    try {
      const { count } = await supabase
        .from('ppe_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Pending');
      setPendingCount(count || 0);
    } catch (error) {
      console.log("No pending requests table yet");
    }
  };

  if (!mounted || pathname === '/login' || pathname === '/' || pathname === '/register') return null;

  const role = user?.rank || user?.position || "";
  const isAdmin = ["Safety Officer", "Chief Officer", "Barge Master"].includes(role);

  const menuItems = [
    ...(isAdmin ? [{ name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard }] : []),
    { name: 'Request PPE', href: '/ppe', icon: Package },
    // เปลี่ยนลิงก์มาใช้ /admin/requests ของคุณ
    ...(isAdmin ? [{ name: 'Requests', href: '/admin/requests', icon: ClipboardList }] : []),
  ];

  const handleLogout = () => {
    localStorage.removeItem('kmt_user');
    router.push('/login');
  };

  return (
    <>
      {/* DESKTOP TOP NAV */}
      <nav className="hidden md:flex fixed top-0 w-full h-16 bg-slate-950/90 backdrop-blur-xl border-b border-white/10 px-6 items-center justify-between z-50 shadow-2xl">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-2 font-black text-blue-500 uppercase tracking-tighter text-2xl">
            <ShieldCheck size={28} className="text-blue-600" /> KMT
          </div>
          <div className="flex items-center gap-1">
            {menuItems.map((item) => (
              <Link key={item.href} href={item.href} className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-all ${pathname === item.href ? 'bg-blue-600/10 text-blue-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                {item.name}
              </Link>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-white/5 px-4 py-1.5 rounded-full border border-white/10">
            <span className="text-xs font-bold text-slate-300 uppercase">{user?.full_name}</span>
            <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-md font-black uppercase">{role}</span>
          </div>
          <div className="w-[1px] h-6 bg-white/10 mx-1"></div>
          
          <Link href={isAdmin ? "/admin/requests" : "#"} className="relative p-2 text-slate-400 hover:text-white transition-colors bg-white/5 rounded-full hover:bg-white/10">
            <Bell size={18} />
            {isAdmin && pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[9px] font-black rounded-full border-2 border-slate-950 px-1">
                {pendingCount}
              </span>
            )}
          </Link>
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-400 transition-colors bg-white/5 rounded-full hover:bg-red-500/10">
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      {/* MOBILE BOTTOM NAV */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-xl border-t border-white/10 h-20 flex items-center justify-around z-50 pb-safe px-2 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.5)]">
        {menuItems.map((item) => (
          <Link key={item.href} href={item.href} className={`flex flex-col items-center gap-1.5 w-full py-2 rounded-xl transition-all ${pathname === item.href ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}>
            <div className={`p-1.5 rounded-lg ${pathname === item.href ? 'bg-blue-500/20' : ''}`}>
              <item.icon size={22} className={pathname === item.href ? "text-blue-400" : ""} />
            </div>
            <span className="text-[9px] font-black uppercase tracking-wider">{item.name}</span>
          </Link>
        ))}
      </nav>

      {/* MOBILE TOP BAR */}
      <div className="md:hidden fixed top-0 w-full h-14 bg-slate-950/95 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-4 z-40 shadow-lg">
        <div className="font-black text-blue-500 uppercase tracking-tighter flex items-center gap-2 text-lg">
          <ShieldCheck size={20} className="text-blue-600" /> KMT
        </div>
        <div className="flex items-center gap-3">
          <Link href={isAdmin ? "/admin/requests" : "#"} className="relative p-2 text-slate-400">
            <Bell size={20} />
            {isAdmin && pendingCount > 0 && (
              <span className="absolute 0 right-0 min-w-[16px] h-[16px] flex items-center justify-center bg-red-500 text-white text-[9px] font-black rounded-full border-2 border-slate-950 px-1">
                {pendingCount}
              </span>
            )}
          </Link>
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-400">
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </>
  );
}
