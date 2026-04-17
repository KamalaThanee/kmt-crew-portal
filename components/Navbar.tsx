"use client";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Package, ShieldCheck, Bell, LogOut, ClipboardList } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  // แก้ไขตรงนี้: เพิ่ม <any> เพื่อบอก TypeScript ว่ารับข้อมูลได้ทุกรูปแบบ
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const storedUser = localStorage.getItem('kmt_user');
    if (storedUser) setUser(JSON.parse(storedUser));
  }, [pathname]);

  if (!mounted || pathname === '/login' || pathname === '/' || pathname === '/register') return null;

  const role = user?.rank || user?.position || "";
  const isAdmin = ["Safety Officer", "Chief Officer", "Barge Master"].includes(role);

  const menuItems = [
    ...(isAdmin ? [{ name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard }] : []),
    { name: 'Request PPE', href: '/ppe', icon: Package },
    ...(isAdmin ? [{ name: 'Pending', href: '/admin/pending', icon: ClipboardList }] : []),
  ];

  const handleLogout = () => {
    localStorage.removeItem('kmt_user');
    router.push('/login');
  };

  return (
    <>
      <nav className="hidden md:flex fixed top-0 w-full h-16 bg-slate-950/80 backdrop-blur-md border-b border-white/10 px-8 items-center justify-between z-50">
        <div className="flex items-center gap-3 font-black text-blue-500 uppercase tracking-tighter text-xl">
          <ShieldCheck size={24} /> KMT Portal
        </div>
        
        <div className="flex items-center gap-6">
          {menuItems.map((item) => (
            <Link key={item.href} href={item.href} className={`text-sm font-bold uppercase tracking-wider transition-colors ${pathname === item.href ? 'text-blue-500' : 'text-slate-400 hover:text-white'}`}>
              {item.name}
            </Link>
          ))}
          
          <div className="w-[1px] h-6 bg-white/10 mx-2"></div>
          
          <button className="relative text-slate-400 hover:text-white transition-colors">
            <Bell size={20} />
            {isAdmin && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-950"></span>}
          </button>

          <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-slate-400 hover:text-red-400 font-bold uppercase tracking-wider transition-colors">
            <LogOut size={18} /> Logout
          </button>
        </div>
      </nav>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950/90 backdrop-blur-md border-t border-white/10 h-16 flex items-center justify-around z-50 pb-safe px-2">
        {menuItems.map((item) => (
          <Link key={item.href} href={item.href} className={`flex flex-col items-center gap-1 w-full py-2 rounded-xl transition-all ${pathname === item.href ? 'text-blue-500 bg-blue-500/10' : 'text-slate-500 hover:text-slate-300'}`}>
            <item.icon size={20} className={pathname === item.href ? "fill-blue-500/20" : ""} />
            <span className="text-[10px] font-bold uppercase tracking-wider">{item.name}</span>
          </Link>
        ))}
      </nav>

      <div className="md:hidden fixed top-0 w-full h-14 bg-slate-950 border-b border-white/5 flex items-center justify-between px-4 z-40">
        <div className="font-black text-blue-500 uppercase tracking-tighter flex items-center gap-2">
          <ShieldCheck size={18} /> KMT
        </div>
        <div className="flex items-center gap-4">
          <button className="relative text-slate-400">
            <Bell size={20} />
            {isAdmin && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-950"></span>}
          </button>
          <button onClick={handleLogout} className="text-slate-400 hover:text-red-400">
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </>
  );
}
