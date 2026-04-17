"use client";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Package, ShieldCheck, Bell, LogOut, ClipboardCheck, ShoppingCart, User, Settings, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    setMounted(true);
    const storedUser = localStorage.getItem('kmt_user');
    if (storedUser) setUser(JSON.parse(storedUser));
  }, [pathname]);

  if (!mounted || pathname === '/login' || pathname === '/' || pathname === '/register') return null;

  const role = user?.rank || user?.position || "";
  const isAdmin = ["Safety Officer", "Chief Officer", "Barge Master"].includes(role);

  // 🎯 แก้ไขตรงนี้: เอา Request PPE ใส่ให้ทุกคน
  const menuItems = isAdmin ? [
    { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Approvals', href: '/admin/approvals', icon: ClipboardCheck },
    { name: 'Inventory', href: '/admin/inventory', icon: Package },
    { name: 'Request PPE', href: '/ppe', icon: ShoppingCart }, // Admin ก็เบิกได้
  ] : [
    { name: 'Request PPE', href: '/ppe', icon: Package },
    { name: 'My Requests', href: '/my-requests', icon: Clock },
  ];

  const handleLogout = () => {
    localStorage.removeItem('kmt_user');
    router.push('/login');
  };

  return (
    <nav className="fixed top-0 w-full h-16 bg-slate-950/90 backdrop-blur-xl border-b border-white/10 px-6 flex items-center justify-between z-50">
      <div className="flex items-center gap-10">
        <div className="flex items-center gap-2 font-black text-blue-500 uppercase text-2xl">
          <ShieldCheck size={28} /> KMT
        </div>
        <div className="hidden md:flex items-center gap-1">
          {menuItems.map((item) => (
            <Link key={item.href} href={item.href} className={`px-4 py-2 rounded-lg text-sm font-bold uppercase ${pathname === item.href ? 'bg-blue-600/10 text-blue-400' : 'text-slate-400 hover:text-white'}`}>
              {item.name}
            </Link>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-4">
        {isAdmin && <Link href="/admin/approvals" className="text-slate-400 hover:text-white"><Bell size={20} /></Link>}
        <button onClick={handleLogout} className="text-slate-400 hover:text-red-400"><LogOut size={20} /></button>
      </div>
    </nav>
  );
}
