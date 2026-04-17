"use client";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Package, ShieldCheck, Bell, LogOut, ClipboardCheck, ShoppingCart, User, Settings, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [cartCount, setCartCount] = useState(0);

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

    const handleCartUpdate = (e: any) => setCartCount(e.detail);
    window.addEventListener('cart-updated', handleCartUpdate);
    return () => window.removeEventListener('cart-updated', handleCartUpdate);
  }, [pathname]);

  const fetchPendingCount = async () => {
    const { count } = await supabase
      .from('ppe_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    setPendingCount(count || 0);
  };

  if (!mounted || pathname === '/login' || pathname === '/' || pathname === '/register') return null;

  const role = user?.rank || user?.position || "";
  const isAdmin = ["Safety Officer", "Chief Officer", "Barge Master"].includes(role);

  const menuItems = isAdmin ? [
    { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Approvals', href: '/admin/approvals', icon: ClipboardCheck },
    { name: 'Request PPE', href: '/ppe', icon: ShoppingCart },
    { name: 'Inventory', href: '/admin/inventory', icon: Package },
  ] : [
    { name: 'Request PPE', href: '/ppe', icon: Package },
    { name: 'My Requests', href: '/my-requests', icon: Clock },
  ];

  const handleLogout = () => {
    localStorage.removeItem('kmt_user');
    router.push('/login');
  };

  const openCart = () => {
    if (pathname === '/ppe') {
      window.dispatchEvent(new CustomEvent('open-cart'));
    } else {
      router.push('/ppe');
    }
  };

  // 🎯 ปรับปรุง: ถ้าไม่ได้อยู่หน้า ppe ให้ไปหน้า ppe พร้อมส่งพารามิเตอร์ settings=true
  const openSettings = () => {
    if (pathname === '/ppe') {
      window.dispatchEvent(new CustomEvent('open-settings'));
    } else {
      router.push('/ppe?settings=true');
    }
    setShowProfile(false);
  };

  const ProfileMenu = () => (
    <div className="absolute right-0 top-14 w-72 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in duration-200">
      <div className="p-4 bg-slate-800/50 border-b border-white/5">
        <p className="text-white font-bold text-sm truncate">{user?.full_name}</p>
        <p className="text-blue-400 text-[10px] font-black uppercase mt-1 tracking-widest">{role}</p>
      </div>
      <div className="p-2">
        {isAdmin && (
          <button onClick={openSettings} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors">
            <Settings size={18} /> Settings
          </button>
        )}
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors font-bold">
          <LogOut size={18} /> Logout
        </button>
      </div>
    </div>
  );

  return (
    <nav className="fixed top-0 w-full h-16 bg-slate-950/90 backdrop-blur-xl border-b border-white/10 px-6 flex items-center justify-between z-[60]">
      <div className="flex items-center gap-10">
        <div className="flex items-center gap-2 font-black text-blue-500 uppercase text-2xl tracking-tighter cursor-pointer" onClick={() => router.push(isAdmin ? '/admin/dashboard' : '/ppe')}>
          <ShieldCheck size={28} className="text-blue-600" /> KMT
        </div>
        <div className="hidden md:flex items-center gap-1">
          {menuItems.map((item) => (
            <Link key={item.href} href={item.href} className={`px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${pathname === item.href ? 'bg-blue-600/10 text-blue-400' : 'text-slate-400 hover:text-white'}`}>
              {item.name}
            </Link>
          ))}
        </div>
      </div>
      
      <div className="flex items-center gap-3 relative">
        <button onClick={openCart} className="relative p-2.5 text-slate-400 hover:text-white bg-white/5 rounded-full transition-colors border border-white/5">
          <ShoppingCart size={20} />
          {cartCount > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-blue-600 text-white text-[9px] font-black rounded-full border-2 border-slate-950 px-1">{cartCount}</span>}
        </button>
        
        {isAdmin && (
          <Link href="/admin/approvals" className="relative p-2.5 text-slate-400 hover:text-white bg-white/5 rounded-full transition-colors border border-white/5">
            <Bell size={20} />
            {pendingCount > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[9px] font-black rounded-full border-2 border-slate-950 px-1">{pendingCount}</span>}
          </Link>
        )}
        
        <div className="w-[1px] h-6 bg-white/10 mx-1"></div>
        
        {/* 🎯 แก้ไข: เอาชื่อออก เหลือแค่ไอคอน */}
        <button onClick={() => setShowProfile(!showProfile)} className="flex items-center justify-center w-10 h-10 text-slate-400 bg-white/5 rounded-full border border-white/5 hover:bg-white/10 transition-all">
          <User size={20} />
        </button>
        {showProfile && <ProfileMenu />}
      </div>
    </nav>
  );
}
