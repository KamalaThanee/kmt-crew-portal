"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CheckCircle, XCircle, AlertTriangle, Clock } from "lucide-react";

export default function AdminRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    setLoading(true);
    // ดึงรายการที่รออนุมัติ
    const { data } = await supabase
      .from("ppe_requests")
      .select("*")
      .eq("status", "Pending")
      .order("created_at", { ascending: false });
    
    if (data) setRequests(data);
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleAction = async (id: string, action: "Approved" | "Rejected") => {
    const confirmAction = confirm(`คุณต้องการ ${action} รายการนี้ใช่หรือไม่?`);
    if (!confirmAction) return;

    // เปลี่ยนแค่สถานะ ยังไม่หักสต็อก!
    const { error } = await supabase
      .from("ppe_requests")
      .update({ status: action })
      .eq("id", id);
    
    if (!error) {
      alert(`บันทึกสถานะเป็น ${action} เรียบร้อยแล้ว ระบบจะแจ้งให้ลูกเรือมารับของ`);
      fetchRequests();
    } else {
      alert("เกิดข้อผิดพลาดในการอัปเดตสถานะ");
    }
  };

  return (
    <div className="p-6 md:p-12 max-w-5xl mx-auto">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-emerald-500 tracking-tighter">PENDING REQUESTS</h1>
          <p className="text-zinc-500 text-sm mt-1">อนุมัติหรือปฏิเสธคำขอเบิก PPE ของลูกเรือ</p>
        </div>
        <div className="bg-blue-500/10 text-blue-500 px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-sm">
          <Clock size={18} /> {requests.length} รายการ
        </div>
      </header>

      {loading ? (
        <p className="text-center text-zinc-500 py-10 animate-pulse">Loading requests...</p>
      ) : requests.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-12 text-center">
          <CheckCircle size={48} className="mx-auto text-zinc-700 mb-4" />
          <h3 className="text-xl font-bold text-zinc-400">ไม่มีคำขอค้างในระบบ</h3>
          <p className="text-zinc-600 text-sm mt-2">ยอดเยี่ยม! คุณเคลียร์งานทั้งหมดแล้ว</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {requests.map((req) => (
            <div key={req.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="bg-zinc-800 px-3 py-1 rounded-lg text-xs font-black uppercase text-zinc-400">{req.crew_name}</span>
                  <span className="text-xs text-zinc-600">{new Date(req.created_at).toLocaleDateString('th-TH')}</span>
                </div>
                <h3 className="text-xl font-black text-white">{req.item_name}</h3>
                <p className="text-zinc-400 text-sm mt-1">
                  Size: <span className="text-white font-bold">{req.size}</span> | 
                  จำนวน: <span className="text-white font-bold">1</span>
                </p>
                
                {/* ระบบแจ้งเตือนโควตาเบื้องต้น */}
                {req.item_name.toLowerCase().includes("boiler") && (
                  <p className="flex items-center gap-1 text-[10px] text-amber-500 font-bold mt-3 bg-amber-500/10 w-fit px-2 py-1 rounded">
                    <AlertTriangle size={12} /> Limit Check: โควตาสูงสุด 2 ชุด/ปี
                  </p>
                )}
                {req.item_name.toLowerCase().includes("boot") && (
                  <p className="flex items-center gap-1 text-[10px] text-amber-500 font-bold mt-3 bg-amber-500/10 w-fit px-2 py-1 rounded">
                    <AlertTriangle size={12} /> Limit Check: โควตาสูงสุด 1 คู่/ปี
                  </p>
                )}
              </div>

              <div className="flex gap-3 w-full md:w-auto">
                <button 
                  onClick={() => handleAction(req.id, "Approved")}
                  className="flex-1 md:flex-none bg-emerald-600/20 text-emerald-500 hover:bg-emerald-600 hover:text-white border border-emerald-500/30 px-6 py-3 rounded-xl font-black transition flex items-center justify-center gap-2"
                >
                  <CheckCircle size={18} /> APPROVE
                </button>
                <button 
                  onClick={() => handleAction(req.id, "Rejected")}
                  className="flex-1 md:flex-none bg-rose-600/20 text-rose-500 hover:bg-rose-600 hover:text-white border border-rose-500/30 px-6 py-3 rounded-xl font-black transition flex items-center justify-center gap-2"
                >
                  <XCircle size={18} /> REJECT
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
