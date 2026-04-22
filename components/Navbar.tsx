"use client";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldCheck, LogOut, FileBadge, Package, ClipboardCheck, PlusCircle, History, LayoutDashboard } from 'lucide-react';
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
      {/* Top Navbar */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 w-[92%] max-w-6xl h-14 bg-black/80 backdrop-blur-md border border-orange-500/30 rounded-2xl z-[60] px-6 hidden md:flex items-center justify-between shadow-[0_0_20px_rgba(249,115,22,0.1)]">
        <div className="flex items-center gap-10">
          <div 
            className="flex items-center gap-2 cursor-pointer group" 
            onClick={() => router.push(isAdmin ? '/admin/dashboard' : '/dashboard')}
          >
            <ShieldCheck size={24} className="text-orange-500" />
            <span className="font-black text-xl tracking-tighter uppercase text-white">KMT</span>
          </div>

          <div className="flex items-center gap-2">
            {menuItems.map((item) => (
              <Link 
                key={item.href} 
                href={item.href} 
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${pathname === item.href ? 'text-white bg-orange-600' : 'text-zinc-400 hover:text-orange-400'}`}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>

        <button onClick={() => { localStorage.removeItem('kmt_user'); router.push('/login'); }} className="p-2 text-zinc-500 hover:text-orange-500 transition-colors">
          <LogOut size={18} />
        </button>
      </nav>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] h-16 bg-black/90 backdrop-blur-2xl border border-orange-500/30 rounded-3xl z-[60] px-2 shadow-[0_0_30px_rgba(249,115,22,0.2)]">
        <div className="flex items-center justify-around h-full">
          <Link href={isAdmin ? '/admin/dashboard' : '/dashboard'} className={`flex flex-col items-center gap-1 ${pathname.includes('dashboard') ? 'text-orange-500' : 'text-zinc-500'}`}>
             <LayoutDashboard size={20} />
             <span className="text-[8px] font-black uppercase">Home</span>
          </Link>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className={`flex flex-col items-center gap-1 ${isActive ? 'text-orange-500' : 'text-zinc-500'}`}>
                <Icon size={20} />
                <span className="text-[8px] font-black uppercase">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
