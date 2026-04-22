"use client";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  ShieldCheck, LogOut, FileBadge, Package, 
  ClipboardCheck, PlusCircle, History, LayoutDashboard 
} from 'lucide-react';
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

  // เมนูที่จัดเรียงใหม่ตามความสำคัญ
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
      {/* Desktop Navbar (Floating) */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 w-[90%] max-w-6xl h-14 bg-zinc-900/40 backdrop-blur-xl border border-white/10 rounded-2xl z-[60] px-6 hidden md:flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-8">
          <div 
            className="flex items-center gap-2 cursor-pointer group" 
            onClick={() => router.push(isAdmin ? '/admin/dashboard' : '/dashboard')}
          >
            <ShieldCheck size={20} className="text-white group-hover:text-blue-500 transition-colors" />
            <span className="font-black text-lg tracking-tighter uppercase">KMT</span>
          </div>

          <div className="flex items-center gap-1">
            {menuItems.map((item) => (
              <Link 
                key={item.href} 
                href={item.href} 
                className={`px-4 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all ${pathname === item.href ? 'text-white bg-white/10' : 'text-zinc-500 hover:text-zinc-200'}`}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>

        <button onClick={() => { localStorage.removeItem('kmt_user'); router.push('/login'); }} className="text-zinc-500 hover:text-red-500 transition-colors">
          <LogOut size={18} />
        </button>
      </nav>

      {/* Mobile Bottom Nav (Minimalist Floating) */}
      <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[88%] h-16 bg-zinc-900/90 backdrop-blur-2xl border border-white/10 rounded-[24px] z-[60] px-2 shadow-2xl">
        <div className="flex items-center justify-around h-full">
          <Link href={isAdmin ? '/admin/dashboard' : '/dashboard'} className={`flex flex-col items-center gap-1 transition-all ${pathname.includes('dashboard') ? 'text-white scale-110' : 'text-zinc-500'}`}>
             <LayoutDashboard size={20} />
             <span className="text-[8px] font-bold uppercase">Home</span>
          </Link>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className={`flex flex-col items-center gap-1 transition-all ${isActive ? 'text-white scale-110' : 'text-zinc-500'}`}>
                <Icon size={20} />
                <span className="text-[8px] font-bold uppercase">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
