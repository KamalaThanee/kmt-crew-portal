import { AlertTriangle, CheckCircle2, Clock, Eye, FileWarning, ShieldCheck } from 'lucide-react'
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
  const mandatoryCount = myCertData.list.filter((cert: any) => cert.is_mandatory).length
  const displayedCerts = personalFilter === 'all' ? myCertData.list : myCertData.list.filter((cert: any) => cert.status === personalFilter)
  const dashboardTiles = [
    { id: 'all', label: 'All', value: myCertData.list.length, detail: 'Required and optional', icon: ShieldCheck, className: 'border-orange-500/30 bg-orange-500/10 text-orange-500' },
    { id: 'ok', label: 'Ready', value: myCertData.ok, detail: 'Valid certificates', icon: CheckCircle2, className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' },
    { id: 'warning', label: '90 Days', value: myCertData.warning, detail: 'Renewal window', icon: Clock, className: 'border-amber-500/30 bg-amber-500/10 text-amber-500' },
    { id: 'expired', label: 'Expired', value: myCertData.expired, detail: 'Needs action', icon: AlertTriangle, className: 'border-red-500/30 bg-red-500/10 text-red-500' },
    { id: 'missing', label: 'Missing', value: myCertData.missing, detail: 'Not uploaded', icon: FileWarning, className: 'border-zinc-500/30 bg-zinc-500/10 text-[var(--muted-text)]' },
  ]

  return (
    <div className="animate-in space-y-8 fade-in">
      <div className="rounded-[36px] border border-orange-500/20 bg-[var(--surface)] p-6 shadow-xl">
        <div className="grid gap-5 lg:grid-cols-[1.1fr_2fr] lg:items-center">
          <div className="flex items-center gap-6">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
              <svg className="h-full w-full -rotate-90 transform">
                <circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="7" fill="transparent" className="text-[var(--chip-bg)]" />
                <circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="7" fill="transparent" strokeDasharray="276" strokeDashoffset={276 - (myCertData.progress / 100) * 276} className="text-orange-500 transition-all duration-1000" />
              </svg>
              <span className="absolute text-xl font-black text-[var(--headline)]">{myCertData.progress}%</span>
            </div>
            <div>
              <h2 className="text-2xl font-black italic uppercase text-[var(--headline)]">My Compliance</h2>
              <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-[var(--subtle)]">{myCertData.ok} / {mandatoryCount} mandatory valid</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {dashboardTiles.map((tile) => {
              const Icon = tile.icon
              const active = personalFilter === tile.id || (tile.id === 'all' && personalFilter === 'all')
              return (
                <button
                  key={tile.id}
                  onClick={() => onPersonalFilterChange(tile.id === 'all' || personalFilter === tile.id ? 'all' : tile.id)}
                  className={`rounded-2xl border p-4 text-left transition-all ${tile.className} ${active ? 'ring-2 ring-orange-500/25 shadow-lg shadow-orange-500/10' : 'hover:-translate-y-0.5 hover:shadow-lg'}`}
                >
                  <Icon size={16} />
                  <p className="mt-4 text-2xl font-black text-[var(--headline)]">{tile.value}</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-widest">{tile.label}</p>
                  <p className="mt-1 text-[9px] font-bold normal-case text-[var(--subtle)]">{tile.detail}</p>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[var(--subtle)]">
          {displayedCerts.length} shown / {myCertData.list.length} certificate records
        </p>
        {displayedCerts.map((item: any, idx: number) => (
          <div key={idx} className={`group grid gap-4 rounded-[24px] border bg-[var(--surface)] p-5 shadow-xl transition-all md:grid-cols-[1fr_auto] md:items-center ${item.status === 'missing' ? 'border-red-500/20' : item.status === 'optional' ? 'border-[var(--border)] opacity-70' : 'border-orange-500/15 hover:border-orange-500/35'}`}>
            <div className="flex min-w-0 items-center gap-4">
              <div className={`rounded-2xl p-3.5 ${item.status === 'ok' ? 'bg-emerald-500/10 text-emerald-500' : item.status === 'warning' ? 'bg-amber-500/10 text-amber-500' : item.status === 'optional' ? 'bg-zinc-500/10 text-[var(--muted-text)]' : 'bg-red-500/10 text-red-500'}`}>
                {item.status === 'ok' ? <CheckCircle2 size={24} /> : item.status === 'optional' ? <Clock size={24} /> : <AlertTriangle size={24} />}
              </div>
              <div className="min-w-0">
                <p className={`mb-1 text-[8px] font-black uppercase tracking-widest ${item.is_mandatory ? 'text-orange-500' : 'text-[var(--muted-text)]'}`}>{item.is_mandatory ? 'Mandatory' : 'Optional'}</p>
                <h3 className="text-sm font-black leading-tight text-[var(--headline)] md:text-base">{item.cert_name}</h3>
                {item.uploaded && <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-[var(--accent-text)]">Exp: {formatExpiryLabel(item.uploaded.expiry_date)}</p>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {item.uploaded?.file_url && (
                <a
                  href={item.uploaded.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-[var(--chip-bg)] p-3 text-orange-500 transition-all hover:bg-orange-600 hover:text-white"
                  aria-label={`Open ${item.cert_name}`}
                  title="Open uploaded certificate"
                >
                  <Eye size={16} />
                </a>
              )}
              <button onClick={() => onUploadCertificate(item.cert_name)} className="rounded-xl bg-orange-600 px-6 py-3 text-[10px] font-black uppercase text-white shadow-lg shadow-orange-600/20 transition-all active:scale-95">Upload</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
