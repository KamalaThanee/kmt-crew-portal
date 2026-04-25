'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function CrewHistory() {
  const [myRequests, setMyRequests] = useState<any[]>([]);

  useEffect(() => { fetchMyRequests(); }, []);

  async function fetchMyRequests() {
    const { data } = await supabase
      .from('ppe_requests')
      .select('*, ppe_inventory(item_name)')
      .order('created_at', { ascending: false });
    if (data) setMyRequests(data);
  }

  async function handleReceived(requestId: string, itemId: string, qty: number) {
    if (!window.confirm("คุณได้รับของเรียบร้อยแล้วใช่หรือไม่?")) return;

    const res = await fetch('/api/requests/receive', {
      method: 'POST',
      body: JSON.stringify({ requestId, itemId, quantity: qty }),
    });

    if (res.ok) {
      alert('บันทึกสำเร็จ! สต็อกถูกหักแล้ว');
      fetchMyRequests();
    } else {
      alert('เกิดข้อผิดพลาดในการตัดสต็อก');
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 text-black">
      <h1 className="text-xl font-bold mb-4">ประวัติการเบิกของฉัน</h1>
      <div className="space-y-3">
        {myRequests.map((req) => (
          <div key={req.id} className="border p-4 rounded-lg bg-white shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold">{req.ppe_inventory?.item_name} ({req.quantity} ชิ้น)</p>
                <p className="text-sm">สถานะ: 
                  <span className={`ml-2 font-semibold ${
                    req.status === 'Approved' ? 'text-green-600' : 
                    req.status === 'Pending' ? 'text-orange-500' : 'text-gray-400'
                  }`}>
                    {req.status}
                  </span>
                </p>
              </div>
              {req.status === 'Approved' && (
                <button 
                  onClick={() => handleReceived(req.id, req.item_id, req.quantity)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm"
                >
                  กดเพื่อยืนยันรับของ
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
