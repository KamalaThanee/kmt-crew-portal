import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Eye,
  Loader2,
  RefreshCcw,
  Search,
  User,
  Users,
  XCircle,
} from 'lucide-react'
import { formatExpiryLabel } from '@/lib/certificates'

type CrewCertificatesPanelProps = {
  allCertTypes: string[]
  allPositions: string[]
  crewSummary: any
  expandedCrews: string[]
  filterMode: string
  filterPos: string
  filterSpecificCert: string
  filteredCertificateDownloads: Array<{ crewName: string; certName: string; url: string; expiryDate?: string }>
  finalDisplayCrews: any[]
  aiBackfillProgress?: string
  aiBackfillRunning?: boolean
  isDownloadingCerts: boolean
  searchTerm: string
  onAiBackfillSelectedPosition?: () => void
  onDownloadFilteredCertificates: () => void
  onEditCrewProfile: (crewId: string) => void
  onExpandedCrewsChange: (updater: (previous: string[]) => string[]) => void
  onFilterModeChange: (mode: string) => void
  onFilterPosChange: (position: string) => void
  onFilterSpecificCertChange: (certName: string) => void
  onSearchTermChange: (term: string) => void
  onUploadCrewCertificate: (certName: string, crewId: string) => void
}

export function CrewCertificatesPanel({
  allCertTypes,
  allPositions,
  crewSummary,
  expandedCrews,
  filterMode,
  filterPos,
  filterSpecificCert,
  filteredCertificateDownloads,
  finalDisplayCrews,
  aiBackfillProgress,
  aiBackfillRunning,
  isDownloadingCerts,
  searchTerm,
  onAiBackfillSelectedPosition,
  onDownloadFilteredCertificates,
  onEditCrewProfile,
  onExpandedCrewsChange,
  onFilterModeChange,
  onFilterPosChange,
  onFilterSpecificCertChange,
  onSearchTermChange,
  onUploadCrewCertificate,
}: CrewCertificatesPanelProps) {
  const summaryTiles = [
    { id: 'all', label: 'All', val: crewSummary.total, className: 'border-blue-500/40 bg-blue-500/10 text-blue-500', icon: <Users size={16}/> },
    { id: 'ready', label: 'Ready', val: crewSummary.ready, className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500', icon: <CheckCircle2 size={16}/> },
    { id: 'warning', label: '90 Days', val: crewSummary.warning, className: 'border-orange-500/40 bg-orange-500/10 text-orange-500', icon: <Clock size={16}/> },
    { id: 'expired', label: 'Expired', val: crewSummary.expired, className: 'border-red-500/40 bg-red-500/10 text-red-500', icon: <XCircle size={16}/> },
    { id: 'action', label: 'Action', val: crewSummary.action, className: 'border-red-600/40 bg-red-500/10 text-red-500', icon: <AlertTriangle size={16}/> }
  ]

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {summaryTiles.map((tile) => (
          <button
            key={tile.id}
            onClick={() => onFilterModeChange(tile.id)}
            className={`rounded-3xl border p-6 text-center shadow-xl transition-all active:scale-95 ${tile.className} ${filterMode === tile.id ? 'ring-2 ring-orange-500/30' : 'opacity-70 hover:opacity-100'}`}
          >
            <p className="text-2xl font-black text-[var(--headline)]">{tile.val}</p>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-[var(--subtle)]">{tile.icon} {tile.label}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-[28px] border border-orange-500/20 bg-[var(--surface)] p-4 shadow-xl md:grid-cols-4">
        <div className="relative md:col-span-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--subtle)]" size={16}/><input type="text" placeholder="Search crew..." value={searchTerm} onChange={(event) => onSearchTermChange(event.target.value)} className="w-full rounded-2xl border border-orange-500/20 bg-[var(--surface-strong)] p-4 pl-12 text-xs font-black text-[var(--headline)] outline-none transition focus:border-orange-500" /></div>
        <select value={filterPos} onChange={(event) => onFilterPosChange(event.target.value)} className="rounded-2xl border border-orange-500/20 bg-[var(--surface-strong)] p-4 text-xs font-black text-[var(--headline)] outline-none transition focus:border-orange-500"><option value="All">All Positions</option>{allPositions.map((position) => <option key={position} value={position}>{position}</option>)}</select>
        <select value={filterSpecificCert} onChange={(event) => onFilterSpecificCertChange(event.target.value)} className="rounded-2xl border border-orange-500/20 bg-[var(--surface-strong)] p-4 text-xs font-black text-[var(--accent-text)] outline-none transition focus:border-orange-500"><option value="All">Select Specific Certificate...</option>{allCertTypes.map((certName) => <option key={certName} value={certName}>{certName}</option>)}</select>
        <button
          onClick={onDownloadFilteredCertificates}
          disabled={filterSpecificCert === 'All' || filteredCertificateDownloads.length === 0 || isDownloadingCerts}
          className="flex items-center justify-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs font-black text-emerald-300 transition-all hover:bg-emerald-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          title={filterSpecificCert === 'All' ? 'Select a specific certificate first' : `Download ${filteredCertificateDownloads.length} matching files as ZIP`}
        >
          {isDownloadingCerts ? <Loader2 className="animate-spin" size={16}/> : <Download size={16}/>}
          {filterSpecificCert === 'All' ? 'Download ZIP' : `ZIP ${filteredCertificateDownloads.length}`}
        </button>
      </div>

      {onAiBackfillSelectedPosition && (
        <div className="grid gap-4 rounded-[28px] border border-blue-500/20 bg-blue-500/5 p-4 shadow-xl md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-blue-500">AI missing detail backfill</p>
            <p className="mt-2 text-xs font-bold normal-case text-[var(--subtle)]">
              Select one position first. Reads max 5 uploaded certificates per click, using free AI Studio models only, then saves missing number/date/place fields.
            </p>
            {aiBackfillProgress && <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-[var(--headline)]">{aiBackfillProgress}</p>}
          </div>
          <button
            onClick={onAiBackfillSelectedPosition}
            disabled={filterPos === 'All' || aiBackfillRunning}
            className="flex items-center justify-center gap-3 rounded-2xl border border-blue-500/25 bg-blue-500/10 px-6 py-4 text-[10px] font-black uppercase tracking-widest text-blue-500 transition-all hover:bg-blue-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
          >
            {aiBackfillRunning ? <Loader2 className="animate-spin" size={16}/> : <RefreshCcw size={16}/>}
            AI Read 5 Missing Details
          </button>
        </div>
      )}

      <div className="space-y-4">
        {finalDisplayCrews.map((crew) => {
          const isExpanded = expandedCrews.includes(crew.id)
          const pColor = crew.certData.progress === 100 ? 'text-emerald-500' : crew.certData.expired > 0 ? 'text-red-500' : 'text-amber-500'
          const expandedRows = buildCrewExpandedRows(crew.certData.list || [])

          return (
            <div key={crew.id} className={`overflow-hidden rounded-[32px] border bg-[var(--surface)] transition-all duration-300 ${isExpanded ? 'border-orange-500/50 shadow-2xl' : 'border-orange-500/15 hover:border-orange-500/35'}`}>
              <button onClick={() => onExpandedCrewsChange((prev) => prev.includes(crew.id) ? prev.filter((id) => id !== crew.id) : [...prev, crew.id])} className="w-full p-6 flex flex-col outline-none">
                <div className="w-full flex justify-between items-center mb-3">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500"><User size={20}/></div>
                    <div className="text-left"><p className="text-sm font-black uppercase text-[var(--headline)]">{crew.full_name}</p><p className="mt-1 text-[9px] uppercase tracking-widest text-[var(--subtle)]">{crew.position}</p></div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="hidden text-right md:block"><p className={`text-xl font-black ${pColor}`}>{crew.certData.progress}%</p><p className="text-[8px] uppercase text-[var(--subtle)]">Readiness</p></div>
                    <div className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase ${crew.certData.progress === 100 ? 'bg-emerald-500/10 text-emerald-500' : crew.certData.expired > 0 ? 'bg-red-500/10 text-red-500 animate-pulse' : 'bg-amber-500/10 text-amber-500'}`}>
                      {crew.certData.progress === 100 ? 'Ready' : crew.certData.expired > 0 ? 'Action Required' : 'Pending'}
                    </div>
                    {isExpanded ? <ChevronDown className="text-orange-500" size={24}/> : <ChevronRight className="text-[var(--subtle)]" size={24}/>}
                  </div>
                </div>
              </button>
              {isExpanded && (
                <div className="animate-in border-t border-orange-500/10 bg-orange-500/5 p-6 pt-0 slide-in-from-top-4 md:p-8">
                  <div className="mt-4 space-y-3">
                    {expandedRows.map((row: any, index: number) => (
                      <div key={`${crew.id}-${row.item.cert_name}-${index}`} className="space-y-2">
                        <CrewCertCard cert={row.item} crewId={crew.id} onUploadCrewCertificate={onUploadCrewCertificate} />
                        {row.children.map((child: any) => (
                          <div key={`${crew.id}-${row.item.cert_name}-${child.cert_name}`} className="pl-4 md:pl-10">
                            <CrewCertCard cert={child} crewId={crew.id} onUploadCrewCertificate={onUploadCrewCertificate} child />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <button onClick={() => onEditCrewProfile(crew.id)} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-orange-500/20 bg-[var(--surface-strong)] py-4 text-[9px] font-black uppercase text-[var(--subtle)] transition-all hover:border-orange-500 hover:text-[var(--headline)]">Edit Crew Profile <ChevronRight size={14}/></button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function normalizeCertName(value: unknown) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function buildCrewExpandedRows(items: any[]) {
  const itemByName = new Map(items.map((item) => [normalizeCertName(item.cert_name), item]))
  const childNames = new Set<string>()

  const rows = items.map((item) => {
    const requiredCerts = Array.isArray(item.requiredCerts) ? item.requiredCerts : item.requiredCert ? [item.requiredCert] : []
    const children = requiredCerts.map((requiredCert: string) => {
      const child = itemByName.get(normalizeCertName(requiredCert))
      if (child) {
        childNames.add(normalizeCertName(child.cert_name))
        return child
      }
      return {
        cert_name: requiredCert,
        status: 'missing',
        uploaded: null,
        triggerCert: item.cert_name,
        relationKind: 'requirement',
        cert_family: item.cert_family || item.category,
        virtualRelated: true,
      }
    })
    return { item, children }
  })

  return rows.filter((row) => !childNames.has(normalizeCertName(row.item.cert_name)) && !row.item.triggerCert)
}

function CrewCertCard({
  cert,
  crewId,
  onUploadCrewCertificate,
  child,
}: {
  cert: any
  crewId: string
  onUploadCrewCertificate: (certName: string, crewId: string) => void
  child?: boolean
}) {
  const statusBorder =
    cert.status === 'ok'
      ? 'border-l-emerald-500'
      : cert.status === 'expired'
        ? 'border-l-red-500'
        : cert.status === 'warning'
          ? 'border-l-amber-500'
          : 'border-l-zinc-400'

  const statusText =
    cert.status === 'ok'
      ? 'text-emerald-500'
      : cert.status === 'expired'
        ? 'text-red-500'
        : 'text-[var(--subtle)]'

  const childLabel =
    cert.relationKind === 'proficiency'
      ? 'Related proficiency'
      : cert.relationKind === 'requirement'
        ? 'Related requirement'
        : 'Child certificate'

  return (
    <div className={`flex items-center justify-between rounded-2xl border border-orange-500/10 bg-[var(--surface-strong)] p-4 border-l-4 ${statusBorder} ${child ? 'bg-blue-500/5 border-blue-500/20' : ''}`}>
      <div className="min-w-0">
        {child && <p className="mb-1 text-[8px] font-black uppercase tracking-widest text-blue-500">{childLabel}</p>}
        <p className="text-[11px] font-black uppercase leading-tight text-[var(--headline)]">{cert.cert_name}</p>
        <p className={`mt-1 text-[8px] font-bold uppercase ${statusText}`}>{cert.uploaded ? `Expiry: ${formatExpiryLabel(cert.uploaded.expiry_date)}` : 'Document Missing'}</p>
        {cert.satisfiedByRefresher && (
          <p className="mt-1 text-[8px] font-black uppercase tracking-widest text-emerald-500">Satisfied by refresher</p>
        )}
      </div>
      <div className="ml-4 flex gap-2 shrink-0">
        {cert.uploaded?.file_url && <a href={cert.uploaded.file_url} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-orange-500/10 p-2 text-orange-500 hover:bg-orange-600 hover:text-white"><Eye size={16}/></a>}
        <button onClick={() => onUploadCrewCertificate(cert.cert_name, crewId)} className="rounded-lg bg-orange-600/10 p-2 text-orange-500 hover:bg-orange-600 hover:text-white"><RefreshCcw size={16}/></button>
      </div>
    </div>
  )
}
