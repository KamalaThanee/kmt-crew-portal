"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CheckCircle, XCircle, Clock } from "lucide-react";

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);

  const fetchRequests = async () => {
    const { data, error } = await supabase.from("ppe_requests").select("*").eq("status", "Pending").order("request_date", { ascending: false });
    if (!error && data) setRequests(data);
  };
  useEffect(() => { fetchRequests(); }, []);

  const handleApprove = async (id: string) => {
    const { error } = await supabase.from("ppe_requests").update({ status: "Approved" }).eq("id", id);
    if (!error) fetchRequests();
  };

  const handleReject = async () => {
    if (!selectedReqId || !rejectReason) return;
    const { error } = await supabase.from("ppe_requests").update({ status: "Rejected", rejection_reason: rejectReason }).eq("id", selectedReqId);
    if (!error) { setRejectReason(""); setSelectedReqId(null); fetchRequests(); }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2 text-slate-800"><Clock className="text-blue-500" /> Pending Requests</h1>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr><th className="p-4 font-semibold text-slate-700">Crew ID</th><th className="p-4 font-semibold text-slate-700">Item</th><th className="p-4 font-semibold text-slate-700">Variant</th><th className="p-4 font-semibold text-slate-700 text-center">Actions</th></tr>
          </thead>
          <tbody>
            {requests.map((req) => (
              <tr key={req.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                <td className="p-4 text-slate-600">{req.crew_id}</td>
                <td className="p-4 font-bold text-slate-800">{req.item_name}</td>
                <td className="p-4 text-slate-500">{req.size} / {req.color}</td>
                <td className="p-4 flex justify-center gap-2">
                  <button onClick={() => handleApprove(req.id)} className="flex items-center gap-1 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition shadow-sm"><CheckCircle size={16} /> Approve</button>
                  <button onClick={() => setSelectedReqId(req.id)} className="flex items-center gap-1 px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition shadow-sm"><XCircle size={16} /> Reject</button>
                </td>
              </tr>
            ))}
            {requests.length === 0 && <tr><td colSpan={4} className="p-10 text-center text-slate-400">No pending requests found.</td></tr>}
          </tbody>
        </table>
      </div>
      {selectedReqId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-96 border border-slate-200">
            <h2 className="text-lg font-bold mb-4 text-slate-800">Reason for Rejection</h2>
            <textarea className="w-full border border-slate-200 rounded-xl p-3 mb-4 focus:ring-2 focus:ring-rose-500 focus:outline-none" rows={3} placeholder="Enter reason..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            <div className="flex justify-end gap-3">
              <button onClick={() => setSelectedReqId(null)} className="px-4 py-2 text-slate-500 font-medium hover:bg-slate-100 rounded-lg">Cancel</button>
              <button onClick={handleReject} className="px-4 py-2 bg-rose-500 text-white font-bold rounded-lg hover:bg-rose-600 transition">Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
