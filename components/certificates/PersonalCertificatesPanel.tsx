import { AlertTriangle, CheckCircle2, Clock, Eye } from 'lucide-react'
import { formatExpiryLabel } from '@/lib/certificates'

type PersonalCertificatesPanelProps = {
  myCertData: any
  personalFilter: string
  onPersonalFilterChange: (filter: string) => void
  onUploadCertificate: (certName: string) => void
}

export function PersonalCertificatesPanel({
  myCertData,
  personalFilter,
  onPersonalFilterChange,
  onUploadCertificate,
}: PersonalCertificatesPanelProps) {
  const displayedCerts = personalFilter === 'all' ? myCertData.list : myCertData.list.filter((cert: any) => cert.status === personalFilter)

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="bg-zinc-900 border border-orange-500/20 p-8 rounded-[40px] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-8 w-full md:w-auto">
          <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
            <svg className="w-full h-full transform -rotate-90"><circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-white/5"/><circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray="276" strokeDashoffset={276 - (myCertData.progress/100)*276} className="text-orange-500 transition-all duration-1000"/></svg>
            <span className="absolute text-xl font-black">{myCertData.progress}%</span>
          </div>
          <div><h2 className="text-2xl font-black italic uppercase">My Compliance</h2><p className="text-zinc-500 mt-1 uppercase text-[10px] tracking-widest">{myCertData.ok} / {myCertData.list.filter((cert: any) => cert.is_mandatory).length} Mandatory Valid</p></div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full md:w-auto">
          {[
            { id: 'ok', label: 'Ready', val: myCertData.ok, color: 'border-emerald-500', text: 'text-emerald-500' },
            { id: 'warning', label: '90 Days', val: myCertData.warning, color: 'border-orange-500', text: 'text-orange-500' },
            { id: 'expired', label: 'Expired', val: myCertData.expired, color: 'border-red-500', text: 'text-red-500' },
            { id: 'missing', label: 'Missing', val: myCertData.missing, color: 'border-zinc-700', text: 'text-zinc-500' }
          ].map((tile) => (
            <button key={tile.id} onClick={() => onPersonalFilterChange(personalFilter === tile.id ? 'all' : tile.id)} className={`bg-black/40 p-4 rounded-2xl border-t-2 ${tile.color} transition-all ${personalFilter === tile.id ? 'bg-zinc-800 ring-2 ring-white/10' : 'hover:bg-zinc-800/50'}`}>
              <p className={`text-xl font-black ${tile.text}`}>{tile.val}</p>
              <p className="text-[8px] text-zinc-500 mt-1">{tile.label}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {displayedCerts.map((item: any, idx: number) => (
          <div key={idx} className={`bg-zinc-900 border ${item.status === 'missing' ? 'border-red-500/20' : item.status === 'optional' ? 'border-white/5 opacity-50' : 'border-white/10'} rounded-[24px] p-5 flex items-center justify-between gap-4 group hover:border-orange-500/30 transition-all shadow-xl`}>
            <div className="flex items-center gap-4">
              <div className={`p-3.5 rounded-2xl ${item.status === 'ok' ? 'bg-emerald-500/10 text-emerald-500' : item.status === 'warning' ? 'bg-amber-500/10 text-amber-500' : item.status === 'optional' ? 'bg-slate-800 text-slate-500' : 'bg-red-500/10 text-red-500'}`}>
                {item.status === 'ok' ? <CheckCircle2 size={24}/> : item.status === 'optional' ? <Clock size={24}/> : <AlertTriangle size={24}/>}
              </div>
              <div><p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${item.is_mandatory ? 'text-blue-500' : 'text-zinc-600'}`}>{item.is_mandatory ? 'MANDATORY' : 'OPTIONAL'}</p><h3 className="text-white text-xs md:text-sm font-black leading-tight">{item.cert_name}</h3>{item.uploaded && <p className="text-[9px] mt-1 text-blue-500 font-black">Exp: {formatExpiryLabel(item.uploaded.expiry_date)}</p>}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {item.uploaded?.file_url && (
                <a
                  href={item.uploaded.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-white/5 p-3 text-orange-500 transition-all hover:bg-orange-600 hover:text-white"
                  aria-label={`Open ${item.cert_name}`}
                  title="Open uploaded certificate"
                >
                  <Eye size={16} />
                </a>
              )}
              <button onClick={() => onUploadCertificate(item.cert_name)} className="px-6 py-3 bg-orange-600 rounded-xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all">Upload</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
