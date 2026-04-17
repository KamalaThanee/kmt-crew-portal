import { ShieldCheck, Package, AlertTriangle } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:pt-24 pb-24">
      <div className="max-w-6xl mx-auto space-y-6">
        <header><h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1></header>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl"><ShieldCheck className="text-emerald-500 mb-2" /><p className="text-2xl font-bold italic">Fleet Safe</p></div>
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl"><Package className="text-emerald-500 mb-2" /><p className="text-2xl font-bold">1,248 Items</p></div>
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl"><AlertTriangle className="text-amber-500 mb-2" /><p className="text-2xl font-bold text-amber-500 underline">3 Alerts</p></div>
        </div>
      </div>
    </div>
  );
}
