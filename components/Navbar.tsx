"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, ClipboardCheck, PackagePlus, Bell } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    // เช็คว่ารันบน Client และดึงข้อมูลผู้ใช้
    const session = localStorage.getItem("crew_session");
    if (session) {
      const parsed = JSON.parse(session);
      setRole(parsed.role);
    }

    // ดึงจำนวนคำขอที่รออนุมัติสำหรับกระดิ่งแจ้งเตือน
    const fetchPending = async () => {
      const { count } = await supabase
        .from("ppe_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "Pending");
      setPendingCount(count || 0);
    };

    fetchPending();
    
    // ตั้งเวลาเช็คใหม่ทุกๆ 1 นาที (เผื่อมีคนกดเบิกเข้ามาใหม่)
    const interval = setInterval(fetchPending, 60000);
    return () => clearInterval(interval);
  }, []);

  // ถ้ายังไม่ล็อกอิน ไม่ต้องโชว์ Navbar
  if (!role) return null;

  const isAdmin = ["Safety Officer", "Chief Officer", "Barge Master"].includes(role);

  return (
    <nav className="fixed top-0 w-full bg-zinc-950 border-b border-zinc-800 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-emerald-500 font-black tracking-tighter text-xl">
            KMT<span className="text-white">PORTAL</span>
          </Link>
          
          {/* เมนูสำหรับหน้าจอคอม */}
          <div className="hidden md:flex items-center gap-6 text-sm font-bold">
            {isAdmin && (
              <Link href="/admin/dashboard" className={`flex items-center gap-2 transition ${pathname === '/admin/dashboard' ? 'text-emerald-500' : 'text-zinc-500 hover:text-white'}`}>
                <LayoutDashboard size={16} /> Dashboard
              </Link>
            )}
            <Link href="/" className={`flex items-center gap-2 transition ${pathname === '/' ? 'text-emerald-500' : 'text-zinc-500 hover:text-white'}`}>
              <Package size={16} /> เบิก PPE
            </Link>
            {isAdmin && (
              <>
                <Link href="/admin/requests" className={`flex items-center gap-2 transition relative ${pathname === '/admin/requests' ? 'text-emerald-500' : 'text-zinc-500 hover:text-white'}`}>
                  <ClipboardCheck size={16} /> Pending Requests
                </Link>
                <Link href="/admin/restock" className={`flex items-center gap-2 transition ${pathname === '/admin/restock' ? 'text-emerald-500' : 'text-zinc-500 hover:text-white'}`}>
                  <PackagePlus size={16} /> Restock
                </Link>
              </>
            )}
          </div>
        </div>

        {/* กระดิ่งแจ้งเตือน */}
        <div className="relative">
          <div className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white cursor-pointer transition">
            <Bell size={20} />
            {isAdmin && pendingCount > 0 && (
              <span className="absolute top-0 right-0 w-4 h-4 bg-rose-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-zinc-950">
                {pendingCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
