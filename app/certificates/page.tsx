'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { CrewCertificatesPanel } from '@/components/certificates/CrewCertificatesPanel'
import { PersonalCertificatesPanel } from '@/components/certificates/PersonalCertificatesPanel'
import { createZipBlob, getFileExtension, safeFileName, triggerDownload } from '@/lib/certificateDownloads'
import { isNoExpiryDate } from '@/lib/certificates'
import { canViewShipCertificates, isAdminRole } from '@/lib/roles'
import { toast } from 'sonner'
import { ArrowRight, ShipWheel, ShieldCheck } from 'lucide-react'

const normalize = (str: string) => String(str || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();
const isCrewActive = (crew: any) => crew?.is_active !== false && !crew?.resigned_at;

function CertificatesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('personal')
  const [loading, setLoading] = useState(true)
  
  const [matrix, setMatrix] = useState<any[]>([])
  const [myCerts, setMyCerts] = useState<any[]>([])
  const [allCerts, setAllCerts] = useState<any[]>([])
  const [crews, setCrews] = useState<any[]>([])
  const [rules, setRules] = useState<any[]>([])
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState('')
  const [filterMode, setFilterMode] = useState('all') 
  const [filterPos, setFilterPos] = useState('All')
  const [filterSpecificCert, setFilterSpecificCert] = useState('All')
  const [personalFilter, setPersonalFilter] = useState('all') 
  const [expandedCrews, setExpandedCrews] = useState<string[]>([])
  const [isDownloadingCerts, setIsDownloadingCerts] = useState(false)

  const canManageCertificates = useMemo(() => isAdminRole(currentUser?.position) || canViewShipCertificates(currentUser?.position), [currentUser]);
  const canOpenShipCertificates = useMemo(() => canViewShipCertificates(currentUser?.position), [currentUser]);

  const fetchData = async () => {
    const [m, c, crewsRes, allC, r] = await Promise.all([
      supabase.from('cert_matrix').select('*'),
      supabase.from('crew_certs').select('*').eq('crew_id', currentUser?.id),
      supabase.from('crews').select('*').order('full_name'),
      supabase.from('crew_certs').select('*'),
      supabase.from('cert_rules').select('*')
    ]);
    if (m.data) setMatrix(m.data);
    if (c.data) setMyCerts(c.data);
    if (crewsRes.data) setCrews(crewsRes.data.filter(isCrewActive));
    if (allC.data) setAllCerts(allC.data);
    if (r.data) setRules(r.data);
    setLoading(false);
  }

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('kmt_user') || 'null');
    if (!u) { router.push('/login'); return; }
    setCurrentUser(u);
  }, [router]);

  useEffect(() => {
    const tab = searchParams.get('tab')
    const crewFilter = searchParams.get('filter')
    const personal = searchParams.get('personal')

    if (tab === 'crew' && canManageCertificates) setActiveTab('crew')
    if (tab === 'personal') setActiveTab('personal')
    if (tab === 'ship' && canOpenShipCertificates) setActiveTab('ship')

    if (crewFilter && ['all', 'ready', 'warning', 'expired', 'action'].includes(crewFilter)) {
      setFilterMode(crewFilter)
    }

    if (personal && ['all', 'ok', 'warning', 'expired', 'missing'].includes(personal)) {
      setPersonalFilter(personal)
    }
  }, [canManageCertificates, canOpenShipCertificates, searchParams])

  useEffect(() => {
    if (currentUser) fetchData();
  }, [currentUser]);

  const calculateCerts = (targetCrew: any, crewCertList: any[]) => {
    if (!matrix.length) return { progress: 0, ok: 0, expired: 0, warning: 0, missing: 0, list: [] };
    const uPos = normalize(targetCrew.position);
    let required = matrix.filter(row => normalize(row.position) === uPos && (row.requirement_type === 'P' || row.requirement_type === 'O'))
      .map(m => ({ ...m, is_mandatory: m.requirement_type === 'P' }));
    
    (rules || []).forEach(rule => {
      if (crewCertList.some(c => normalize(c.cert_name) === normalize(rule.trigger_cert))) {
        const idx = required.findIndex(req => normalize(req.cert_name) === normalize(rule.required_cert));
        if (idx === -1) {
          const info = matrix.find(m => normalize(m.cert_name) === normalize(rule.required_cert));
          required.push({ cert_name: rule.required_cert, is_mandatory: true, category: info?.category || 'Additional' });
        } else { required[idx].is_mandatory = true; }
      }
    });

    const today = new Date();
    let ok = 0, expired = 0, warning = 0, missing = 0, mandatoryTotal = 0;

    const list = required.map(req => {
      if (req.is_mandatory) mandatoryTotal++;
      const uploaded = crewCertList.find(c => normalize(c.cert_name) === normalize(req.cert_name));
      let status = req.is_mandatory ? 'missing' : 'optional';
      let daysLeft = -1;
      if (uploaded) {
        if (isNoExpiryDate(uploaded.expiry_date)) { status = 'ok'; ok++; daysLeft = 9999; }
        else {
          const expDate = new Date(uploaded.expiry_date);
          daysLeft = Math.floor((expDate.getTime() - today.getTime()) / 86400000);
          if (daysLeft < 0) { status = 'expired'; expired++; }
          else if (daysLeft <= 90) { status = 'warning'; warning++; ok++; }
          else { status = 'ok'; ok++; }
        }
      } else if (req.is_mandatory) missing++;
      return { ...req, uploaded, status, daysLeft };
    }).sort((a, b) => {
       const weight: any = { expired: 1, missing: 2, warning: 3, ok: 4, optional: 5 };
       return weight[a.status] - weight[b.status];
    });

    return { 
      list, 
      progress: mandatoryTotal > 0 ? Math.round((ok / mandatoryTotal) * 100) : 0, 
      ok, expired, warning, missing 
    };
  }

  const myCertData = useMemo(() => calculateCerts(currentUser || {}, myCerts), [currentUser, myCerts, matrix, rules]);

  const allPositions = useMemo(() => ['All', ...new Set(crews.map(c => c.position))].sort(), [crews]);
  const allCertTypes = useMemo(() => ['All', ...new Set(matrix.map(m => m.cert_name))].sort(), [matrix]);

  const enhancedCrews = useMemo(() => {
    return crews.map(c => ({ ...c, certData: calculateCerts(c, allCerts.filter(ac => ac.crew_id === c.id)) }))
    .filter(crew => {
      const matchSearch = crew.full_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchPos = filterPos === 'All' || crew.position === filterPos;
      let matchCert = true;
      if (filterSpecificCert !== 'All') {
        matchCert = crew.certData.list.some((cert: any) => normalize(cert.cert_name) === normalize(filterSpecificCert) && cert.status !== 'missing' && cert.status !== 'optional');
      }
      return matchSearch && matchPos && matchCert;
    });
  }, [crews, allCerts, matrix, rules, searchTerm, filterPos, filterSpecificCert]);

  const crewSummary = useMemo(() => {
    return {
      total: enhancedCrews.length,
      ready: enhancedCrews.filter(c => c.certData.progress === 100 && c.certData.expired === 0).length, // 🎯 ใช้ 'ready'
      warning: enhancedCrews.filter(c => c.certData.warning > 0 && c.certData.expired === 0).length,
      expired: enhancedCrews.filter(c => c.certData.expired > 0).length,
      action: enhancedCrews.filter(c => c.certData.progress < 100 || c.certData.expired > 0).length
    }
  }, [enhancedCrews]);

  const finalDisplayCrews = useMemo(() => {
    return enhancedCrews.filter(c => {
      if (filterMode === 'all') return true;
      if (filterMode === 'ready') return c.certData.progress === 100 && c.certData.expired === 0;
      if (filterMode === 'warning') return c.certData.warning > 0 && c.certData.expired === 0;
      if (filterMode === 'expired') return c.certData.expired > 0;
      if (filterMode === 'action') return c.certData.progress < 100 || c.certData.expired > 0;
      return true;
    });
  }, [enhancedCrews, filterMode]);

  const filteredCertificateDownloads = useMemo(() => {
    if (filterSpecificCert === 'All') return []

    return finalDisplayCrews
      .map((crew: any) => {
        const cert = crew.certData.list.find((item: any) => normalize(item.cert_name) === normalize(filterSpecificCert))
        if (!cert?.uploaded?.file_url) return null
        return {
          crewName: crew.full_name,
          certName: cert.cert_name,
          url: cert.uploaded.file_url,
          expiryDate: cert.uploaded.expiry_date,
        }
      })
      .filter(Boolean) as Array<{ crewName: string; certName: string; url: string; expiryDate?: string }>
  }, [filterSpecificCert, finalDisplayCrews])

  const handleDownloadFilteredCertificates = async () => {
    if (filterSpecificCert === 'All') {
      toast.error('Select a specific certificate first')
      return
    }

    if (filteredCertificateDownloads.length === 0) {
      toast.error('No uploaded certificate files in the current filter')
      return
    }

    setIsDownloadingCerts(true)

    try {
      const files: Array<{ name: string; data: Uint8Array }> = []
      for (const cert of filteredCertificateDownloads) {
        const baseName = `${safeFileName(cert.crewName)}_${safeFileName(cert.certName)}`
        const response = await fetch(cert.url)
        if (!response.ok) throw new Error(`Unable to fetch ${cert.crewName}`)
        const blob = await response.blob()
        const ext = getFileExtension(cert.url, response.headers.get('content-type'))
        files.push({ name: `${baseName}.${ext}`, data: new Uint8Array(await blob.arrayBuffer()) })
      }

      const zipBlob = createZipBlob(files)
      const zipUrl = URL.createObjectURL(zipBlob)
      const stamp = new Date().toISOString().slice(0, 10)
      triggerDownload(zipUrl, `${safeFileName(filterSpecificCert)}_certificates_${stamp}.zip`)
      window.setTimeout(() => URL.revokeObjectURL(zipUrl), 3000)
      toast.success(`Downloaded ZIP with ${files.length} certificate${files.length === 1 ? '' : 's'}`)
    } catch (error: any) {
      toast.error(error.message || 'Unable to create ZIP')
    } finally {
      setIsDownloadingCerts(false)
    }
  }

  if (loading || !currentUser) return <div className="min-h-screen bg-black flex items-center justify-center text-orange-500 font-black animate-pulse">VAULT ACCESSING...</div>

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-32 pt-28 font-sans text-white uppercase font-bold text-[10px]">
      
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           <h1 className="text-3xl md:text-4xl font-black italic flex items-center gap-3"><ShieldCheck className="text-orange-500" size={36}/> Certificate Hub</h1>
           <p className="text-zinc-500 mt-1 tracking-widest">Enterprise Compliance Dashboard</p>
        </div>
        
        {canManageCertificates && (
          <div className="flex bg-zinc-900 p-1.5 rounded-2xl border border-white/5 w-fit shadow-2xl">
            <button onClick={() => setActiveTab('personal')} className={`px-8 py-3 rounded-xl transition-all ${activeTab === 'personal' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-zinc-500 hover:text-white'}`}>My Certs</button>
            <button onClick={() => setActiveTab('crew')} className={`px-8 py-3 rounded-xl transition-all ${activeTab === 'crew' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-zinc-500 hover:text-white'}`}>Crew Certificates</button>
            {canOpenShipCertificates && <button onClick={() => setActiveTab('ship')} className={`px-8 py-3 rounded-xl transition-all ${activeTab === 'ship' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-zinc-500 hover:text-white'}`}>Ship Certs</button>}
          </div>
        )}
      </div>

      {activeTab === 'personal' && (
        <PersonalCertificatesPanel
          myCertData={myCertData}
          personalFilter={personalFilter}
          onPersonalFilterChange={setPersonalFilter}
          onUploadCertificate={(certName) => router.push(`/certificates/upload?cert=${encodeURIComponent(certName)}`)}
        />
      )}

      {activeTab === 'crew' && canManageCertificates && (
        <CrewCertificatesPanel
          allCertTypes={allCertTypes}
          allPositions={allPositions}
          crewSummary={crewSummary}
          expandedCrews={expandedCrews}
          filterMode={filterMode}
          filterPos={filterPos}
          filterSpecificCert={filterSpecificCert}
          filteredCertificateDownloads={filteredCertificateDownloads}
          finalDisplayCrews={finalDisplayCrews}
          isDownloadingCerts={isDownloadingCerts}
          searchTerm={searchTerm}
          onDownloadFilteredCertificates={handleDownloadFilteredCertificates}
          onEditCrewProfile={(crewId) => router.push(`/admin/settings?tab=crews&id=${crewId}`)}
          onExpandedCrewsChange={setExpandedCrews}
          onFilterModeChange={setFilterMode}
          onFilterPosChange={setFilterPos}
          onFilterSpecificCertChange={setFilterSpecificCert}
          onSearchTermChange={setSearchTerm}
          onUploadCrewCertificate={(certName, crewId) => router.push(`/certificates/upload?cert=${encodeURIComponent(certName)}&crewId=${crewId}`)}
        />
      )}
      {activeTab === 'ship' && canOpenShipCertificates && (
        <button
          onClick={() => router.push('/admin/ship-certificates')}
          className="group grid w-full gap-6 rounded-[42px] border border-cyan-500/20 bg-cyan-500/10 p-8 text-left shadow-2xl shadow-cyan-950/30 transition-all hover:-translate-y-1 hover:border-cyan-300 md:grid-cols-[auto_1fr_auto] md:items-center"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-[28px] border border-cyan-400/20 bg-black/40 text-cyan-300">
            <ShipWheel size={34} />
          </div>
          <div>
            <p className="text-2xl font-black italic text-white">Ship Certificates</p>
            <p className="mt-2 text-xs normal-case text-cyan-100/70">Vessel compliance, expiry, annual survey, and document upload control.</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-cyan-500 px-5 py-4 text-xs font-black uppercase tracking-widest text-black">
            Open Ship Certs <ArrowRight size={16} />
          </div>
        </button>
      )}
    </div>
  )
}

export default function CertificatesPage() {
  return ( <Suspense fallback={<div>Loading...</div>}><CertificatesContent /></Suspense> )
}
