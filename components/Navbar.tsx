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
    const { count } = await supabase
      .from('ppe_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    setPendingCount(count || 0);
  };

  if (!mounted || pathname === '/login' || pathname === '/' || pathname === '/register') return null;

  const role = user?.rank || user?.position || "";
  const isAdmin = ["Safety Officer", "Chief Officer", "Barge Master"].includes(role);

  // เมนูที่ถูกต้อง: Admin ต้องมี Request PPE ด้วย
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

  // Profile Dropdown Drawer
  const ProfileMenu = () => (
    <div className="absolute right-0 top-14 w-72 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
      <div className="p-4 bg-slate-800/50 border-b border-white/5">
        <p className="text-white font-bold text-sm truncate">{user?.full_name}</p>
        <p className="text-blue-400 text-xs font-black uppercase mt-1">{role}</p>
      </div>
      <div className="p-4 space-y-4 border-b border-white/5">
        <div>
          <div className="flex justify-between text-xs font-bold text-slate-400 mb-1 uppercase"><span>Boiler Suit</span><span>0 / 2</span></div>
          <div className="w-full bg-slate-950 rounded-full h-2"><div className="bg-blue-500 h-2 rounded-full w-0"></div></div>
        </div>
        <div>
          <div className="flex justify-between text-xs font-bold text-slate-400 mb-1 uppercase"><span>Safety Boots</span><span>0 / 1</span></div>
          <div className="w-full bg-slate-950 rounded-full h-2"><div className="bg-orange-500 h-2 rounded-full w-0"></div></div>
        </div>
      </div>
      <div className="p-2">
        <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors">
          <Settings size={16} /> Settings
        </button>
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors">
          <LogOut size={16} /> Logout
        </button>
      </div>
    </div>
  );

  return (
    <nav className="fixed top-0 w-full h-16 bg-slate-950/90 backdrop-blur-xl border-b border-white/10 px-6 flex items-center justify-between z-50">
      <div className="flex items-center gap-10">
        <div className="flex items-center gap-2 font-black text-blue-500 uppercase text-2xl">
          <ShieldCheck size={28} className="text-blue-600" /> KMT
        </div>
        <div className="hidden md:flex items-center gap-1">
          {menuItems.map((item) => (
            <Link key={item.href} href={item.href} className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-all ${pathname === item.href ? 'bg-blue-600/10 text-blue-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              {item.name}
            </Link>
          ))}
        </div>
      </div>
      
      <div className="flex items-center gap-3 relative">
        <Link href="/cart" className="p-2 text-slate-400 hover:text-white bg-white/5 rounded-full"><ShoppingCart size={20} /></Link>
        
        {isAdmin && (
          <Link href="/admin/approvals" className="relative p-2 text-slate-400 hover:text-white bg-white/5 rounded-full">
            <Bell size={20} />
            {pendingCount > 0 && <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] flex items-center justify-center bg-red-500 text-white text-[10px] font-black rounded-full border-2 border-slate-950">{pendingCount}</span>}
          </Link>
        )}
        
        <div className="w-[1px] h-6 bg-white/10 mx-1"></div>
        
        <button onClick={() => setShowProfile(!showProfile)} className="flex items-center gap-2 p-1.5 pr-4 text-slate-400 bg-white/5 rounded-full border border-white/5 hover:bg-white/10">
          <div className="w-8 h-8 bg-blue-900 rounded-full flex items-center justify-center text-blue-400"><User size={18} /></div>
          <span className="text-xs font-bold uppercase truncate max-w-[100px] hidden md:block">{user?.full_name?.split(' ')[0]}</span>
        </button>
        {showProfile && <ProfileMenu />}
      </div>
    </nav>
  );
}
