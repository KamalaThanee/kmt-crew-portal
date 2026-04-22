"use client";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldCheck, Bell, LogOut, ShoppingCart, User, Settings, FileBadge, Package, ClipboardCheck, PlusCircle, History } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';

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

  // 🎯 ตัด DASHBOARD ออก ใช้ Logo แทน
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
      {/* Top Floating Nav */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 w-[92%] max-w-5xl h-14 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl z-[60] px-4 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-6">
          {/* Logo กดกลับหน้าแรก */}
          <div 
            className="flex items-center gap-2 cursor-pointer group" 
            onClick={() => router.push(isAdmin ? '/admin/dashboard' : '/dashboard')}
          >
            <ShieldCheck size={22} className="text-white group-hover:text-blue-500 transition-colors" />
            <span className="font-black text-lg tracking-tighter uppercase">KMT</span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-1">
            {menuItems.map((item) => (
              <Link 
                key={item.href} 
                href={item.href} 
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all ${pathname === item.href ? 'text-white' : 'text-zinc-500 hover:text-white'}`}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => { localStorage.removeItem('kmt_user'); router.push('/login'); }} className="p-2 text-zinc-500 hover:text-red-500 transition-colors">
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] h-16 bg-zinc-900/90 backdrop-blur-2xl border border-white/10 rounded-3xl z-[60] px-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-around h-full">
          {/* เพิ่มปุ่ม Home (Dashboard) ให้มือถือ */}
          <Link href={isAdmin ? '/admin/dashboard' : '/dashboard'} className={`flex flex-col items-center gap-1 ${pathname.includes('dashboard') ? 'text-white' : 'text-zinc-500'}`}>
             <ShieldCheck size={20} />
             <span className="text-[9px] font-bold uppercase">Home</span>
          </Link>
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={`flex flex-col items-center gap-1 ${pathname === item.href ? 'text-white' : 'text-zinc-500'}`}>
                <Icon size={20} />
                <span className="text-[9px] font-bold uppercase">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
