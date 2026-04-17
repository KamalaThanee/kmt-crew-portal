"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, ShieldCheck } from 'lucide-react';

export default function Navbar({ userRole }: { userRole: string }) {
  const pathname = usePathname();
  const isAdmin = ["Safety Officer", "Chief Officer", "Barge Master"].includes(userRole);
  const menuItems = [
    ...(isAdmin ? [{ name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard }] : []),
    { name: 'Inventory', href: '/ppe', icon: Package },
  ];
  if (pathname === '/login' || pathname === '/') return null;

  return (
    <>
      <nav className="hidden md:flex fixed top-0 w-full h-16 bg-zinc-950 border-b border-zinc-800 px-8 items-center justify-between z-50">
        <div className="flex items-center gap-2 font-bold text-emerald-500 uppercase tracking-tighter">
          <ShieldCheck size={20} /> KMT Portal
        </div>
        <div className="flex gap-4">
          {menuItems.map((item) => (
            <Link key={item.href} href={item.href} className={`text-sm ${pathname === item.href ? 'text-emerald-500 font-bold' : 'text-zinc-400'}`}>{item.name}</Link>
          ))}
        </div>
      </nav>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 h-16 flex items-center justify-around z-50 pb-safe">
        {menuItems.map((item) => (
          <Link key={item.href} href={item.href} className={`flex flex-col items-center gap-1 ${pathname === item.href ? 'text-emerald-500' : 'text-zinc-500'}`}>
            <item.icon size={20} />
            <span className="text-[10px] uppercase">{item.name}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
