"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Clock, CheckCircle2, XCircle, Package, Calendar } from "lucide-react";

export default function MyRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('kmt_user') || '{}');
    if (user.id) {
      fetchRequests(user.id);
    }
  }, []);

  const fetchRequests = async (userId: string) => {
    const { data } = await supabase
      .from('ppe_requests')
      .select('*')
      .eq('crew_id', userId)
      .order('request_date', { ascending: false });
    
    if (data) setRequests(data);
    setIsLoading(false);
  };

  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'rejected': return 'text-red-400 bg-red-500/10 border-red-500/20';
      default: return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto pt-24">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black text-white uppercase tracking-wider">My Requests</h1>
        <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">History & Status tracking</p>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-slate-500 font-bold uppercase tracking-[0.3em] animate-pulse">Loading History...</div>
      ) : requests.length === 0 ? (
        <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-20 text-center flex flex-col items-center">
          <Package className="text-slate-700 mb-4" size={48} />
          <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">No request history found</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {requests.map((req) => (
            <div key={req.id} className="bg-slate-900 border border-white/5 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-white/10 transition-colors">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${getStatusStyle(req.status)} border`}>
                  {req.status === 'approved' ? <CheckCircle2 size={20}/> : req.status === 'rejected' ? <XCircle size={20}/> : <Clock size={20}/>}
                </div>
                <div>
                  <h3 className="text-white font-bold uppercase text-sm tracking-wide">{req.item_name}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-blue-400 font-black uppercase tracking-tighter bg-blue-500/10 px-2 py-0.5 rounded-md">Size: {req.size}</span>
                    <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1 uppercase tracking-tighter">
                      <Calendar size={10}/> {new Date(req.request_date).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between md:justify-end border-t border-white/5 pt-3 md:border-none md:pt-0">
                <span className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-full border ${getStatusStyle(req.status)} tracking-widest`}>
                  {req.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
