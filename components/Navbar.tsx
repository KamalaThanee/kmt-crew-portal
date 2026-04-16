"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, ClipboardCheck, PackagePlus, Bell, LogOut } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const [userData, setUserData] = useState<any>(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const user = localStorage.getItem("kmt_user");
    if (user) {
      setUserData(JSON.parse(user));
    }

    const fetchPending = async () => {
      const { count } = await supabase.from("ppe_requests").select("*", { count: "exact", head: true }).eq("status", "Pending");
      setPendingCount(count || 0);
    };
    fetchPending();
  }, [pathname]);

  if (!userData || pathname === '/login' || pathname === '/register') return null;

  const isAdmin = ["Safety Officer", "Chief Officer", "Barge Master"].includes(userData.position);

  return (
    <nav className="fixed top-0 w-full bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-emerald-500 font-black text-xl tracking-tighter">KMT</Link>
          <div className="hidden md:flex gap-4 text-xs font-bold uppercase tracking-widest">
            {isAdmin && (
              <Link href="/admin/dashboard" className={`flex items-center gap-2 ${pathname.includes('dashboard') ? 'text-emerald-500' : 'text-zinc-500 hover:text-white'}`}>
                <LayoutDashboard size={14} /> Dashboard
              </Link>
            )}
            <Link href="/ppe" className={`flex items-center gap-2 ${pathname.includes('ppe') ? 'text-emerald-500' : 'text-zinc-500 hover:text-white'}`}>
              <Package size={14} /> เบิก PPE
            </Link>
            {isAdmin && (
              <>
                <Link href="/admin/requests" className={`flex items-center gap-2 relative ${pathname.includes('requests') ? 'text-emerald-500' : 'text-zinc-500 hover:text-white'}`}>
                  <ClipboardCheck size={14} /> Pending
                  {pendingCount > 0 && <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />}
                </Link>
                <Link href="/admin/restock" className={`flex items-center gap-2 ${pathname.includes('restock') ? 'text-emerald-500' : 'text-zinc-500 hover:text-white'}`}>
                  <PackagePlus size={14} /> Restock
                </Link>
              </>
            )}
          </div>
        </div>
        <button onClick={() => { localStorage.removeItem("kmt_user"); window.location.href = "/login"; }} className="text-zinc-500 hover:text-rose-500 transition">
          <LogOut size={20} />
        </button>
      </div>
    </nav>
  );
}
