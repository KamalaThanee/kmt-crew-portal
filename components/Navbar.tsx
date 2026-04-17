"use client";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Package, ShieldCheck, Bell, LogOut, ClipboardCheck, ShoppingCart, User, Settings, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  const [quotas, setQuotas] = useState({ suit: 0, boot: 0 });

  useEffect(() => {
    setMounted(true);
    const storedUser = localStorage.getItem('kmt_user');
    if (storedUser) {
      const u = JSON.parse(storedUser);
      setUser(u);
      const role = u.rank || u.position || "";
      
      // ดึงข้อมูลแจ้งเตือน (เฉพาะ Admin)
      if (["Safety Officer", "Chief Officer", "Barge Master"].includes(role)) {
        fetchPendingCount();
      }
      // ดึงข้อมูลโควต้าจริง
      fetchQuotas(u.id);
    }

    const handleCartUpdate = (e: any) => setCartCount(e.detail);
    window.addEventListener('cart-updated', handleCartUpdate);
    return () => window.removeEventListener('cart-updated', handleCartUpdate);
  }, [pathname]);

  const fetchPendingCount = async () => {
    const { count } = await supabase
      .from('ppe_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    setPendingCount(count || 0);
  };

  const fetchQuotas = async (userId: string) => {
    const currentYear = new Date().getFullYear();
    const startOfYear = `${currentYear}-01-01T00:00:00Z`;
    const { data: reqs } = await supabase
      .from('ppe_requests')
      .select('item_name')
      .eq('crew_id', userId)
      .neq('status', 'rejected')
      .gte('request_date', startOfYear);

    if (reqs) {
      setQuotas({ 
        suit: reqs.filter(r => r.item_name.toLowerCase().includes('suit')).length, 
        boot: reqs.filter(r => r.item_name.toLowerCase().includes('safety boot') && !r.item_name.toLowerCase().includes('rubber')).length 
      });
    }
  };

  if (!mounted || pathname === '/login' || pathname === '/' || pathname === '/register') return null;

  const role = user?.rank || user?.position || "";
  const isAdmin = ["Safety Officer", "Chief Officer", "Barge Master"].includes(role);

  const openSettings = () => {
    if (pathname === '/ppe') {
      window.dispatchEvent(new CustomEvent('open-settings'));
    } else {
      router.push('/ppe?settings=true');
    }
    setShowProfile(false);
  };

  const ProfileMenu = () => (
    <div className="absolute right-0 top-14 w-72 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[70] animate-in fade-in zoom-in duration-200">
      <div className="p-5 bg-slate-800/50 border-b border-white/5">
        <p className="text-white font-bold text-base truncate">{user?.full_name}</p>
        <p className="text-blue-400 text-[10px] font-black uppercase mt-1 tracking-widest">{role}</p>
      </div>
      
      {/* 🎯 แสดงโควต้าจริงใน Profile */}
      <div className="p-5 space-y-4 border-b border-white/5">
        <div>
          <div className="flex justify-between text-[10px] font-black text-slate-400 mb-1.5 uppercase tracking-widest">
            <span>Boiler Suit</span>
            <span className={quotas.suit >= 2 ? "text-red-400" : "text-blue-400"}>{quotas.suit} / 2</span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-1.5">
            <div className={`h-1.5 rounded-full transition-all duration-500 ${quotas.suit >= 2 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${(quotas.suit / 2) * 100}%` }}></div>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[10px] font-black text-slate-400 mb-1.5 uppercase tracking-widest">
            <span>Safety Boots</span>
            <span className={quotas.boot >= 1 ? "text-red-400" : "text-indigo-400"}>{quotas.boot} / 1</span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-1.5">
            <div className={`h-1.5 rounded-full transition-all duration-500 ${quotas.boot >= 1 ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${(quotas.boot / 1) * 100}%` }}></div>
          </div>
        </div>
      </div>

      <div className="p-2">
        {isAdmin && (
          <button onClick={openSettings} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors">
            <Settings size={18} /> Settings
          </button>
        )}
        <button onClick={() => { localStorage.removeItem('kmt_user'); router.push('/login'); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors font-bold">
          <LogOut size={18} /> Logout
        </button>
      </div>
    </div>
  );

  return (
    <nav className="fixed top-0 w-full h-16 bg-slate-950/90 backdrop-blur-xl border-b border-white/10 px-6 flex items-center justify-between z-[60]">
      <div className="flex items-center gap-10">
        <div className="flex items-center gap-2 font-black text-blue-500 uppercase text-2xl tracking-tighter cursor-pointer" onClick={() => router.push(isAdmin ? '/admin/dashboard' : '/ppe')}>
          <ShieldCheck size={28} className="text-blue-600" /> KMT
        </div>
        <div className="hidden md:flex items-center gap-1">
          {isAdmin ? (
            <>
              <Link href="/admin/dashboard" className={`px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest ${pathname === '/admin/dashboard' ? 'bg-blue-600/10 text-blue-400' : 'text-slate-400'}`}>Dashboard</Link>
              <Link href="/admin/approvals" className={`px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest ${pathname === '/admin/approvals' ? 'bg-blue-600/10 text-blue-400' : 'text-slate-400'}`}>Approvals</Link>
              <Link href="/ppe" className={`px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest ${pathname === '/ppe' ? 'bg-blue-600/10 text-blue-400' : 'text-slate-400'}`}>Request PPE</Link>
              <Link href="/admin/inventory" className={`px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest ${pathname === '/admin/inventory' ? 'bg-blue-600/10 text-blue-400' : 'text-slate-400'}`}>Inventory</Link>
            </>
          ) : (
            <>
              <Link href="/ppe" className={`px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest ${pathname === '/ppe' ? 'bg-blue-600/10 text-blue-400' : 'text-slate-400'}`}>Request PPE</Link>
              <Link href="/my-requests" className={`px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest ${pathname === '/my-requests' ? 'bg-blue-600/10 text-blue-400' : 'text-slate-400'}`}>My Requests</Link>
            </>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3 relative">
        <button onClick={() => window.dispatchEvent(new CustomEvent('open-cart'))} className="relative p-2.5 text-slate-400 hover:text-white bg-white/5 rounded-full border border-white/5 transition-colors">
          <ShoppingCart size={20} />
          {cartCount > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-blue-600 text-white text-[9px] font-black rounded-full border-2 border-slate-950 px-1">{cartCount}</span>}
        </button>
        
        {isAdmin && (
          <Link href="/admin/approvals" className="relative p-2.5 text-slate-400 hover:text-white bg-white/5 rounded-full border border-white/5 transition-colors">
            <Bell size={20} />
            {/* 🎯 แก้ Logic: ถ้าเป็น 0 ไม่ต้องแสดง Badge เลย */}
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[9px] font-black rounded-full border-2 border-slate-950 px-1">
                {pendingCount}
              </span>
            )}
          </Link>
        )}
        
        <div className="w-[1px] h-6 bg-white/10 mx-1"></div>
        
        {/* 🎯 ลบชื่อออก เหลือแค่ไอคอนโปรไฟล์ */}
        <button onClick={() => setShowProfile(!showProfile)} className="w-10 h-10 flex items-center justify-center text-slate-400 bg-white/5 rounded-full border border-white/5 hover:bg-white/10 transition-all">
          <User size={20} />
        </button>
        {showProfile && <ProfileMenu />}
      </div>
    </nav>
  );
}
