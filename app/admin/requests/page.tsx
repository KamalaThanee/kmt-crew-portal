"use client";
export default function RequestsPage() {
  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      <div className="space-y-1">
        <h1 className="text-2xl font-black text-white uppercase tracking-wider">PPE Requests</h1>
        <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Review and approve crew requests</p>
      </div>
      <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-10 text-center flex flex-col items-center justify-center min-h-[40vh]">
        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4"><span className="text-3xl">📋</span></div>
        <h3 className="text-white font-bold text-lg">No Pending Requests</h3>
        <p className="text-slate-500 text-sm mt-2">There are currently no requests waiting for your approval.</p>
      </div>
    </div>
  );
}
