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
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const storedUser = localStorage.getItem('kmt_user');
    if (storedUser) setUser(JSON.parse(storedUser));
  }, [pathname]);

  if (!mounted || ['/login', '/register'].includes(pathname)) return null;

  const role = (user?.position || "").toLowerCase();
  const isAdmin = ["safety officer", "chief officer", "barge master"].includes(role);

  // 🎯 เรียงลำดับเมนูให้มืออาชีพ: งานส่วนตัว -> งานบริหาร -> คลัง -> ใบเซอร์
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
      <nav className="fixed top-0 w-full h-16 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 px-6 flex items-center justify-between z-[60]">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2 font-black text-blue-500 text-2xl tracking-tighter cursor-pointer" onClick={() => router.push(isAdmin ? '/admin/dashboard' : '/dashboard')}>
            <ShieldCheck size={28} className="text-blue-600" /> KMT
          </div>
          <div className="hidden md:flex items-center gap-1 font-black text-[10px] tracking-[0.2em]">
            {menuItems.map((item) => (
              <Link key={item.href} href={item.href} className={`px-4 py-2 rounded-lg border transition-all ${pathname === item.href ? 'bg-blue-600/10 text-blue-400 border-blue-500/20' : 'text-slate-400 border-transparent hover:text-slate-200'}`}>{item.name}</Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { localStorage.removeItem('kmt_user'); router.push('/login'); }} className="p-2.5 text-red-400/50 hover:text-red-400 transition-colors"><LogOut size={20}/></button>
        </div>
      </nav>
      {/* BOTTOM NAV (Mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950/90 backdrop-blur-xl border-t border-white/10 z-[60] h-16">
        <div className="flex items-center justify-around h-full">
          {menuItems.slice(0, 5).map((item) => {
            const Icon = item.icon; const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className={`flex flex-col items-center justify-center gap-1 w-full h-full relative ${isActive ? 'text-blue-500' : 'text-slate-500'}`}>
                <Icon size={20} /><span className="text-[8px] font-black tracking-tighter">{item.name}</span>
                {isActive && <div className="absolute bottom-1 w-5 h-0.5 bg-blue-500 rounded-full shadow-[0_0_10px_#3b82f6]"></div>}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
