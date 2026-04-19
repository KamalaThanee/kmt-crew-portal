"use client";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Package, 
  ShieldCheck, 
  Bell, 
  LogOut, 
  ClipboardCheck, 
  ShoppingCart, 
  User, 
  Settings, 
  History,
  PlusCircle
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
  const [quotas, setQuotas] = useState({ suit: 0, boot: 0 });
  
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const storedUser = localStorage.getItem('kmt_user');
    if (storedUser) {
      const u = JSON.parse(storedUser);
      setUser(u);
      fetchNotifications(u);
      fetchQuotas(u.id);
    }

    setShowProfile(false);
    const handleCartUpdate = (e: any) => setCartCount(e.detail);
    window.addEventListener('cart-updated', handleCartUpdate);
    
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfile(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener('cart-updated', handleCartUpdate);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [pathname]);

  const fetchNotifications = async (u: any) => {
    const role = u.rank || u.position || "";
    const isAdmin = ["Safety Officer", "Chief Officer", "Barge Master"].some(r => r.toLowerCase() === role.toLowerCase());

    if (isAdmin) {
      const { count } = await supabase.from('ppe_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending');
      setNotifCount(count || 0);
    } else {
      const { count } = await supabase.from('ppe_requests').select('*', { count: 'exact', head: true }).eq('crew_id', u.id).in('status', ['approved', 'rejected']);
      setNotifCount(count || 0);
    }
  };

  const fetchQuotas = async (userId: string) => {
    const currentYear = new Date().getFullYear();
    const startOfYear = `${currentYear}-01-01T00:00:00Z`;
    const { data: reqs } = await supabase.from('ppe_requests').select('item_name').eq('crew_id', userId).neq('status', 'rejected').gte('request_date', startOfYear);
    if (reqs) {
      setQuotas({ 
        suit: reqs.filter(r => r.item_name.toLowerCase().includes('suit')).length, 
        boot: reqs.filter(r => r.item_name.toLowerCase().includes('safety boot') && !r.item_name.toLowerCase().includes('rubber')).length 
      });
    }
  };

  if (!mounted || pathname === '/login' || pathname === '/' || pathname === '/register') return null;

  const role = user?.rank || user?.position || "";
  const isAdmin = ["Safety Officer", "Chief Officer", "Barge Master"].some(r => r.toLowerCase() === role.toLowerCase());

  const menuItems = isAdmin ? [
    { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Approvals', href: '/admin/approvals', icon: ClipboardCheck },
    { name: 'Request', href: '/ppe', icon: PlusCircle },
    { name: 'Inventory', href: '/admin/inventory', icon: Package },
    { name: 'My Req', href: '/my-requests', icon: History },
  ] : [
    { name: 'Request PPE', href: '/ppe', icon: PlusCircle },
    { name: 'My Requests', href: '/my-requests', icon: History },
  ];

  return (
    <>
      <nav className="fixed top-0 w-full h-14 md:h-16 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 px-4 md:px-6 flex items-center justify-between z-[60]">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2 font-black text-blue-500 uppercase text-xl md:text-2xl tracking-tighter cursor-pointer" onClick={() => router.push(isAdmin ? '/admin/dashboard' : '/ppe')}>
            <ShieldCheck size={24} className="text-blue-600" /> <span>KMT</span>
          </div>
          <div className="hidden md:flex items-center gap-1 font-black uppercase text-[10px] tracking-widest">
            {menuItems.map((item) => (
              <Link key={item.href} href={item.href} className={`px-4 py-2 rounded-lg border transition-all ${pathname === item.href ? 'bg-blue-600/10 text-blue-400 border-blue-500/20' : 'text-slate-400 border-transparent hover:text-slate-200'}`}>
                {item.name}
              </Link>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-3 relative" ref={profileRef}>
          <button onClick={() => window.dispatchEvent(new CustomEvent('open-cart'))} className="relative p-2 md:p-2.5 text-slate-400 hover:text-white bg-white/5 rounded-full border border-white/5 transition-colors">
            <ShoppingCart size={18} />
            {cartCount > 0 && <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] flex items-center justify-center bg-blue-600 text-white text-[8px] font-black rounded-full border-2 border-slate-950 px-1">{cartCount}</span>}
          </button>
          
          <Link href={isAdmin ? "/admin/approvals" : "/my-requests"} className="relative p-2 md:p-2.5 text-slate-400 hover:text-white bg-white/5 rounded-full border border-white/5 transition-colors">
            <Bell size={18} />
            {notifCount > 0 && <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] flex items-center justify-center bg-red-500 text-white text-[8px] font-black rounded-full border-2 border-slate-950 px-1">{notifCount}</span>}
          </Link>
          
          <button onClick={() => setShowProfile(!showProfile)} className={`w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-full border transition-all ${showProfile ? 'bg-blue-600 text-white border-blue-400' : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'}`}>
            <User size={18} />
          </button>
          
          {showProfile && (
            <div className="absolute right-0 top-14 w-72 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[70] animate-in fade-in zoom-in duration-200">
              <div className="p-5 bg-slate-800/50 border-b border-white/5">
                <p className="text-white font-bold text-base truncate">{user?.full_name}</p>
                <p className="text-blue-400 text-[10px] font-black uppercase mt-1 tracking-widest">{role}</p>
              </div>
              <div className="p-2">
                {isAdmin && (
                  <Link href="/admin/settings" onClick={() => setShowProfile(false)} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors">
                    <Settings size={18} /> Admin Settings
                  </Link>
                )}
                <button onClick={() => { localStorage.removeItem('kmt_user'); router.push('/login'); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors font-bold uppercase tracking-widest text-[11px]">
                  <LogOut size={18} /> Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* BOTTOM NAV */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950/90 backdrop-blur-xl border-t border-white/10 z-[60]">
        <div className="flex items-center justify-around h-16">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className={`flex flex-col items-center justify-center gap-1 w-full h-full relative ${isActive ? 'text-blue-500' : 'text-slate-500'}`}>
                <Icon size={20} />
                <span className="text-[9px] font-bold uppercase tracking-tighter">{item.name}</span>
                {isActive && <div className="absolute bottom-1 w-5 h-0.5 bg-blue-500 rounded-full"></div>}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
