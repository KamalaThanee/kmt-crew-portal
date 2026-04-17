"use client";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Package, ShieldCheck, Bell, LogOut, ClipboardCheck, ShoppingCart, User, Settings, Clock } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // สถานะจำลองสำหรับ UI (เดี๋ยวเชื่อม DB ภายหลัง)
  const cartItemsCount = 2; 
  const pendingApprovalsCount = 3;

  useEffect(() => {
    setMounted(true);
    const storedUser = localStorage.getItem('kmt_user');
    if (storedUser) setUser(JSON.parse(storedUser));
  }, [pathname]);

  if (!mounted || pathname === '/login' || pathname === '/' || pathname === '/register') return null;

  const role = user?.rank || user?.position || "";
  const isAdmin = ["Safety Officer", "Chief Officer", "Barge Master"].includes(role);

  // เมนูแบ่งตามสิทธิ์
  const menuItems = isAdmin ? [
    { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Approvals', href: '/admin/approvals', icon: ClipboardCheck },
    { name: 'Inventory', href: '/admin/inventory', icon: Package },
  ] : [
    { name: 'PPE Catalog', href: '/ppe', icon: Package },
    { name: 'My Requests', href: '/my-requests', icon: Clock },
  ];

  const handleLogout = () => {
    localStorage.removeItem('kmt_user');
    router.push('/login');
  };

  // --- COMPONENT: Profile Dropdown ---
  const ProfileMenu = () => (
    <div className="absolute right-0 top-12 w-72 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
      <div className="p-4 bg-slate-800/50 border-b border-white/5">
        <p className="text-white font-bold text-sm truncate">{user?.full_name || "Crew Member"}</p>
        <p className="text-blue-400 text-xs font-black uppercase mt-1">{role}</p>
      </div>
      <div className="p-4 space-y-4 border-b border-white/5">
        <div>
          <div className="flex justify-between text-xs font-bold text-slate-400 mb-1 uppercase">
            <span>Boiler Suit</span><span>0 / 2</span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-2"><div className="bg-blue-500 h-2 rounded-full w-0"></div></div>
        </div>
        <div>
          <div className="flex justify-between text-xs font-bold text-slate-400 mb-1 uppercase">
            <span>Safety Boots</span><span>0 / 1</span>
          </div>
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
    <>
      {/* --- DESKTOP TOP NAV --- */}
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
        
        {/* Right Side Icons */}
        <div className="flex items-center gap-2 relative">
          {!isAdmin && (
            <Link href="/cart" className="relative p-2.5 text-slate-400 hover:text-white transition-colors bg-white/5 rounded-full hover:bg-white/10">
              <ShoppingCart size={20} />
              {cartItemsCount > 0 && <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] flex items-center justify-center bg-blue-600 text-white text-[10px] font-black rounded-full border-2 border-slate-950 px-1">{cartItemsCount}</span>}
            </Link>
          )}

          <Link href={isAdmin ? "/admin/approvals" : "#"} className="relative p-2.5 text-slate-400 hover:text-white transition-colors bg-white/5 rounded-full hover:bg-white/10 ml-2">
            <Bell size={20} />
            {isAdmin && pendingApprovalsCount > 0 && <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] flex items-center justify-center bg-red-500 text-white text-[10px] font-black rounded-full border-2 border-slate-950 px-1">{pendingApprovalsCount}</span>}
          </Link>

          <div className="w-[1px] h-8 bg-white/10 mx-2"></div>

          {/* Profile Button */}
          <button onClick={() => setShowProfile(!showProfile)} className="flex items-center gap-2 p-1.5 pr-4 text-slate-400 transition-colors bg-white/5 rounded-full hover:bg-white/10 border border-white/5">
            <div className="w-8 h-8 bg-blue-900 rounded-full flex items-center justify-center text-blue-400"><User size={18} /></div>
            <span className="text-xs font-bold uppercase truncate max-w-[100px]">{user?.full_name?.split(' ')[0]}</span>
          </button>
          
          {showProfile && <ProfileMenu />}
        </div>
      </nav>

      {/* --- MOBILE BOTTOM NAV --- */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-xl border-t border-white/10 h-20 flex items-center justify-around z-50 pb-safe px-2">
        {menuItems.map((item) => (
          <Link key={item.href} href={item.href} className={`flex flex-col items-center gap-1.5 w-full py-2 rounded-xl transition-all ${pathname === item.href ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}>
            <div className={`p-1.5 rounded-lg ${pathname === item.href ? 'bg-blue-500/20' : ''}`}><item.icon size={22} /></div>
            <span className="text-[9px] font-black uppercase tracking-wider">{item.name}</span>
          </Link>
        ))}
      </nav>

      {/* --- MOBILE TOP BAR --- */}
      <div className="md:hidden fixed top-0 w-full h-16 bg-slate-950/95 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-4 z-40 shadow-lg">
        <div className="font-black text-blue-500 uppercase tracking-tighter flex items-center gap-2 text-xl"><ShieldCheck size={24} /> KMT</div>
        <div className="flex items-center gap-3 relative">
          {!isAdmin && (
            <Link href="/cart" className="relative p-2 text-slate-400"><ShoppingCart size={22} />
              {cartItemsCount > 0 && <span className="absolute 0 right-0 min-w-[16px] h-[16px] flex items-center justify-center bg-blue-600 text-white text-[9px] font-black rounded-full border-2 border-slate-950">{cartItemsCount}</span>}
            </Link>
          )}
          <Link href={isAdmin ? "/admin/approvals" : "#"} className="relative p-2 text-slate-400"><Bell size={22} />
            {isAdmin && pendingApprovalsCount > 0 && <span className="absolute 0 right-0 min-w-[16px] h-[16px] flex items-center justify-center bg-red-500 text-white text-[9px] font-black rounded-full border-2 border-slate-950">{pendingApprovalsCount}</span>}
          </Link>
          <button onClick={() => setShowProfile(!showProfile)} className="p-1 bg-slate-900 rounded-full border border-white/10"><div className="w-7 h-7 bg-blue-900 rounded-full flex items-center justify-center text-blue-400"><User size={16} /></div></button>
          {showProfile && <ProfileMenu />}
        </div>
      </div>
    </>
  );
}
