'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminDashboard() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchRequests(); }, []);

  async function fetchRequests() {
    const { data } = await supabase
      .from('ppe_requests')
      .select('*, ppe_inventory(item_name)')
      .eq('status', 'Pending')
      .order('created_at', { ascending: false });
    if (data) setRequests(data);
    setLoading(false);
  }

  async function updateStatus(id: string, newStatus: 'Approved' | 'Rejected') {
    const remark = newStatus === 'Rejected' ? prompt('ระบุเหตุผลที่ปฏิเสธ:') : null;
    if (newStatus === 'Rejected' && !remark) return;

    const { error } = await supabase
      .from('ppe_requests')
      .update({ status: newStatus, admin_remark: remark })
      .eq('id', id);

    if (!error) {
      alert(`ทำรายการ ${newStatus} สำเร็จ`);
      fetchRequests();
    }
  }

  if (loading) return <div className="p-8 text-center">กำลังโหลดข้อมูล...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 text-black">
      <h1 className="text-2xl font-bold mb-6">รายการรออนุมัติ (Safety/Chief/Barge)</h1>
      {requests.length === 0 ? (
        <p className="text-gray-500 text-center py-10">ไม่มีรายการค้างอนุมัติ</p>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div key={req.id} className="bg-white border rounded-xl p-4 shadow-sm flex justify-between items-center text-black">
              <div>
                <h3 className="font-bold text-lg text-blue-900">{req.ppe_inventory?.item_name}</h3>
                <p className="text-sm">ผู้เบิก: {req.crew_name} | จำนวน: <span className="font-bold">{req.quantity}</span></p>
              </div>
              <div className="flex gap-2 text-white">
                <button onClick={() => updateStatus(req.id, 'Approved')} className="bg-green-600 px-4 py-2 rounded-lg hover:bg-green-700">Approve</button>
                <button onClick={() => updateStatus(req.id, 'Rejected')} className="bg-red-500 px-4 py-2 rounded-lg hover:bg-red-600">Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
