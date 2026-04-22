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
      {/* Top Nav: Solid & Reliable Bar */}
      <nav className="fixed top-0 left-0 w-full h-16 bg-slate-900 border-b border-slate-800 z-[60] px-6 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-12">
          {/* Logo Section */}
          <div 
            className="flex items-center gap-3 cursor-pointer" 
            onClick={() => router.push(isAdmin ? '/admin/dashboard' : '/dashboard')}
          >
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20">
              <ShieldCheck size={22} className="text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-white uppercase">KMT Portal</span>
          </div>

          {/* Desktop Menu: Clear & Bold */}
          <div className="hidden lg:flex items-center gap-6">
            {menuItems.map((item) => (
              <Link 
                key={item.href} 
                href={item.href} 
                className={`text-xs font-bold uppercase tracking-wider transition-colors ${pathname === item.href ? 'text-blue-500 border-b-2 border-blue-500 pb-1' : 'text-slate-400 hover:text-slate-100'}`}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={() => { localStorage.removeItem('kmt_user'); router.push('/login'); }} className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white transition-colors border border-slate-700 rounded-lg text-xs font-bold uppercase tracking-wider">
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </nav>

      {/* Mobile Bottom Nav: Professional Dock */}
      <nav className="lg:hidden fixed bottom-0 left-0 w-full h-16 bg-slate-900 border-t border-slate-800 z-[60] px-2 shadow-[0_-4px_10px_rgba(0,0,0,0.3)]">
        <div className="flex items-center justify-around h-full">
          <Link href={isAdmin ? '/admin/dashboard' : '/dashboard'} className={`flex flex-col items-center gap-1 ${pathname.includes('dashboard') ? 'text-blue-500' : 'text-slate-500'}`}>
             <ShieldCheck size={24} />
             <span className="text-[10px] font-bold">Home</span>
          </Link>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className={`flex flex-col items-center gap-1 ${isActive ? 'text-blue-500' : 'text-slate-500'}`}>
                <Icon size={24} />
                <span className="text-[10px] font-bold">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
