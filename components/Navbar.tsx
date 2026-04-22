"use client";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldCheck, Bell, LogOut, ShoppingCart, User, Settings, FileBadge, Package, ClipboardCheck, PlusCircle, History } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const storedUser = localStorage.getItem('kmt_user');
    if (storedUser) setUser(JSON.parse(storedUser));
  }, []);

  if (!mounted || ['/login', '/register'].includes(pathname)) return null;

  const role = (user?.position || "").toLowerCase();
  const isAdmin = ["safety officer", "chief officer", "barge master"].includes(role);

  const menuItems = isAdmin ? [
    { name: 'Approvals', href: '/admin/approvals', icon: ClipboardCheck },
    { name: 'Inventory', href: '/admin/inventory', icon: Package },
    { name: 'Certs', href: '/certificates', icon: FileBadge },
    { name: 'Request', href: '/ppe', icon: PlusCircle },
  ] : [
    { name: 'Certs', href: '/certificates', icon: FileBadge },
    { name: 'Request', href: '/ppe', icon: PlusCircle },
    { name: 'History', href: '/my-requests', icon: History },
  ];

  return (
    <>
      {/* Top Nav with Cyan Glow */}
      <nav className="fixed top-0 left-0 w-full h-16 bg-slate-950/80 backdrop-blur-md border-b border-cyan-500/20 z-[60] px-6 flex items-center justify-between shadow-[0_4px_30px_rgba(6,182,212,0.1)]">
        <div className="flex items-center gap-10">
          <div 
            className="flex items-center gap-2 cursor-pointer group" 
            onClick={() => router.push(isAdmin ? '/admin/dashboard' : '/dashboard')}
          >
            <div className="p-1.5 bg-cyan-500/10 rounded-lg border border-cyan-500/30 group-hover:shadow-[0_0_15px_rgba(6,182,212,0.5)] transition-all">
              <ShieldCheck size={24} className="text-cyan-400" />
            </div>
            <span className="font-black text-xl tracking-tighter uppercase text-white">KMT</span>
          </div>

          <div className="hidden md:flex items-center gap-2">
            {menuItems.map((item) => (
              <Link 
                key={item.href} 
                href={item.href} 
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all ${pathname === item.href ? 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'text-slate-400 hover:text-white'}`}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={() => { localStorage.removeItem('kmt_user'); router.push('/login'); }} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[10px] font-black uppercase hover:bg-red-500 hover:text-white transition-all">
            <LogOut size={14} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </nav>

      {/* Mobile Bottom Nav (Cyberpunk Style) */}
      <nav className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 w-[94%] h-16 bg-slate-900/90 backdrop-blur-2xl border border-cyan-500/30 rounded-[24px] z-[60] px-2 shadow-[0_10px_40px_rgba(0,255,255,0.15)]">
        <div className="flex items-center justify-around h-full">
          <Link href={isAdmin ? '/admin/dashboard' : '/dashboard'} className={`flex flex-col items-center gap-1 ${pathname.includes('dashboard') ? 'text-cyan-400' : 'text-slate-500'}`}>
             <ShieldCheck size={22} className={pathname.includes('dashboard') ? "drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" : ""} />
             <span className="text-[8px] font-black uppercase">Hub</span>
          </Link>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className={`flex flex-col items-center gap-1 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`}>
                <Icon size={22} className={isActive ? "drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" : ""} />
                <span className="text-[8px] font-black uppercase">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
