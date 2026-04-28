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
  isDownloadingCerts: boolean
  searchTerm: string
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
  isDownloadingCerts,
  searchTerm,
  onDownloadFilteredCertificates,
  onEditCrewProfile,
  onExpandedCrewsChange,
  onFilterModeChange,
  onFilterPosChange,
  onFilterSpecificCertChange,
  onSearchTermChange,
  onUploadCrewCertificate,
}: CrewCertificatesPanelProps) {
  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { id: 'all', label: 'All', val: crewSummary.total, color: 'border-blue-500', icon: <Users size={16}/> },
          { id: 'ready', label: 'Ready', val: crewSummary.ready, color: 'border-emerald-500', icon: <CheckCircle2 size={16}/> },
          { id: 'warning', label: '90 Days', val: crewSummary.warning, color: 'border-orange-500', icon: <Clock size={16}/> },
          { id: 'expired', label: 'Expired', val: crewSummary.expired, color: 'border-red-500', icon: <XCircle size={16}/> },
          { id: 'action', label: 'Action', val: crewSummary.action, color: 'border-red-600', icon: <AlertTriangle size={16}/> }
        ].map((tile) => (
          <button key={tile.id} onClick={() => onFilterModeChange(tile.id)} className={`bg-zinc-900 border-t-4 ${tile.color} p-6 rounded-3xl flex flex-col items-center justify-center transition-all active:scale-95 shadow-xl ${filterMode === tile.id ? 'opacity-100 ring-2 ring-white/20' : 'opacity-40 hover:opacity-100'}`}>
            <p className="text-2xl font-black">{tile.val}</p>
            <p className="text-[8px] mt-2 flex items-center gap-1.5 text-zinc-400">{tile.icon} {tile.label}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-zinc-900/50 p-4 rounded-[28px] border border-white/5">
        <div className="relative md:col-span-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16}/><input type="text" placeholder="Search crew..." value={searchTerm} onChange={(event) => onSearchTermChange(event.target.value)} className="w-full bg-black/50 border border-white/10 p-4 pl-12 rounded-2xl outline-none focus:border-orange-500 text-xs font-bold" /></div>
        <select value={filterPos} onChange={(event) => onFilterPosChange(event.target.value)} className="bg-black/50 border border-white/10 p-4 rounded-2xl outline-none text-xs font-bold text-blue-400"><option value="All">All Positions</option>{allPositions.map((position) => <option key={position} value={position}>{position}</option>)}</select>
        <select value={filterSpecificCert} onChange={(event) => onFilterSpecificCertChange(event.target.value)} className="bg-black/50 border border-white/10 p-4 rounded-2xl outline-none text-xs font-bold text-orange-400"><option value="All">Select Specific Certificate...</option>{allCertTypes.map((certName) => <option key={certName} value={certName}>{certName}</option>)}</select>
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

      <div className="space-y-4">
        {finalDisplayCrews.map((crew) => {
          const isExpanded = expandedCrews.includes(crew.id)
          const pColor = crew.certData.progress === 100 ? 'text-emerald-500' : crew.certData.expired > 0 ? 'text-red-500' : 'text-amber-500'

          return (
            <div key={crew.id} className={`bg-zinc-900 border rounded-[32px] overflow-hidden transition-all duration-300 ${isExpanded ? 'border-orange-500/50 shadow-2xl' : 'border-white/5 hover:border-white/20'}`}>
              <button onClick={() => onExpandedCrewsChange((prev) => prev.includes(crew.id) ? prev.filter((id) => id !== crew.id) : [...prev, crew.id])} className="w-full p-6 flex flex-col outline-none">
                <div className="w-full flex justify-between items-center mb-3">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-zinc-500"><User size={20}/></div>
                    <div className="text-left"><p className="font-black text-sm text-white uppercase">{crew.full_name}</p><p className="text-[9px] text-zinc-500 mt-1 uppercase tracking-widest">{crew.position}</p></div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden md:block"><p className={`text-xl font-black ${pColor}`}>{crew.certData.progress}%</p><p className="text-[8px] text-zinc-600 uppercase">Readiness</p></div>
                    <div className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase ${crew.certData.progress === 100 ? 'bg-emerald-500/10 text-emerald-500' : crew.certData.expired > 0 ? 'bg-red-500/10 text-red-500 animate-pulse' : 'bg-amber-500/10 text-amber-500'}`}>
                      {crew.certData.progress === 100 ? 'Ready' : crew.certData.expired > 0 ? 'Action Required' : 'Pending'}
                    </div>
                    {isExpanded ? <ChevronDown className="text-orange-500" size={24}/> : <ChevronRight className="text-zinc-600" size={24}/>}
                  </div>
                </div>
              </button>
              {isExpanded && (
                <div className="p-6 md:p-8 pt-0 border-t border-white/5 bg-black/20 animate-in slide-in-from-top-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {crew.certData.list.map((cert: any, index: number) => (
                      <div key={index} className={`flex items-center justify-between p-4 rounded-2xl bg-zinc-900 border-l-4 ${cert.status === 'ok' ? 'border-l-emerald-500' : cert.status === 'expired' ? 'border-l-red-500' : cert.status === 'warning' ? 'border-l-amber-500' : 'border-l-zinc-700'}`}>
                        <div>
                          <p className="text-white text-[11px] font-black leading-tight uppercase">{cert.cert_name}</p>
                          <p className={`text-[8px] mt-1 font-bold uppercase ${cert.status === 'ok' ? 'text-emerald-500' : cert.status === 'expired' ? 'text-red-500' : 'text-zinc-500'}`}>{cert.uploaded ? `Expiry: ${formatExpiryLabel(cert.uploaded.expiry_date)}` : 'Document Missing'}</p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {cert.uploaded && <a href={cert.uploaded.file_url} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/5 rounded-lg text-orange-500 hover:bg-orange-600 hover:text-white"><Eye size={16}/></a>}
                          <button onClick={() => onUploadCrewCertificate(cert.cert_name, crew.id)} className="p-2 bg-orange-600/10 text-orange-500 rounded-lg hover:bg-orange-600 hover:text-white"><RefreshCcw size={16}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => onEditCrewProfile(crew.id)} className="w-full py-4 mt-6 bg-zinc-800 border border-white/5 rounded-2xl text-[9px] font-black uppercase text-zinc-400 hover:text-white transition-all flex items-center justify-center gap-2">Edit Crew Profile <ChevronRight size={14}/></button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
