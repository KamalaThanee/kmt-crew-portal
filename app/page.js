import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-900">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-blue-900">KMT Crew Portal</h1>
          <p className="text-slate-500 mt-2">Kamala Thanee Safety Management</p>
        </div>
        <div className="grid gap-6">
          <button className="w-full py-5 bg-slate-100 text-slate-400 rounded-2xl font-semibold text-lg border-2 border-dashed border-slate-300 cursor-not-allowed">
            📂 Crew Certificate (Coming Soon)
          </button>
          <Link href="/ppe" className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-semibold text-lg shadow-lg text-center transition-all">
            📦 PPE Request System
          </Link>
        </div>
        <div className="text-center pt-4 border-t border-slate-100">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Safety First • Reliable Operations</p>
        </div>
      </div>
    </div>
  )
}
