"use client";
export default function RestockPage() {
  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      <div className="space-y-1">
        <h1 className="text-2xl font-black text-white uppercase tracking-wider">Restock Management</h1>
        <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Upload DO/Invoice and update inventory</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900/50 border border-dashed border-white/20 rounded-3xl p-10 flex flex-col items-center justify-center hover:bg-slate-800/50 transition-colors cursor-pointer text-center">
          <span className="text-4xl mb-4">📤</span>
          <h3 className="text-white font-bold">Upload Receipt</h3>
          <p className="text-slate-500 text-xs mt-2">Click to upload DO or Invoice to Supabase Storage</p>
        </div>
        <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-6">
          <h3 className="text-white font-bold mb-4">Recent Restock History</h3>
          <p className="text-slate-500 text-sm text-center py-10">No history found.</p>
        </div>
      </div>
    </div>
  );
}
