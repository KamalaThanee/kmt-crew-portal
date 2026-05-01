'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { CrewCertificatesPanel } from '@/components/certificates/CrewCertificatesPanel'
import { PersonalCertificatesPanel } from '@/components/certificates/PersonalCertificatesPanel'
import { calculateCrewCertificateCompliance } from '@/lib/certCompliance'
import { createZipBlob, getFileExtension, safeFileName, triggerDownload } from '@/lib/certificateDownloads'
import { canViewShipCertificates, isAdminRole } from '@/lib/roles'
import { toast } from 'sonner'
import { ShieldCheck } from 'lucide-react'

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
    if (tab === 'ship' && canOpenShipCertificates) router.replace('/admin/ship-certificates')

    if (crewFilter && ['all', 'ready', 'warning', 'expired', 'action'].includes(crewFilter)) {
      setFilterMode(crewFilter)
    }

    if (personal && ['all', 'ok', 'warning', 'expired', 'missing'].includes(personal)) {
      setPersonalFilter(personal)
    }
  }, [canManageCertificates, canOpenShipCertificates, router, searchParams])

  useEffect(() => {
    if (currentUser) fetchData();
  }, [currentUser]);

  const calculateCerts = (targetCrew: any, crewCertList: any[]) => {
    return calculateCrewCertificateCompliance({ crew: targetCrew, crewCerts: crewCertList, matrix, rules })
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
          <div className="grid w-full max-w-xl grid-cols-3 rounded-[30px] border border-orange-500/20 bg-black/40 p-1.5 text-[10px] font-black uppercase tracking-tight text-zinc-500 shadow-2xl backdrop-blur md:w-[560px]">
            <button onClick={() => setActiveTab('personal')} className={`rounded-[22px] px-4 py-4 transition-all ${activeTab === 'personal' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/25' : 'hover:bg-white/5 hover:text-white'}`}>My Certs</button>
            <button onClick={() => setActiveTab('crew')} className={`rounded-[22px] px-4 py-4 transition-all ${activeTab === 'crew' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/25' : 'hover:bg-white/5 hover:text-white'}`}>Crew Certificates</button>
            {canOpenShipCertificates && <button onClick={() => router.push('/admin/ship-certificates')} className="rounded-[22px] px-4 py-4 transition-all hover:bg-white/5 hover:text-white">Ship Certs</button>}
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
    </div>
  )
}

export default function CertificatesPage() {
  return ( <Suspense fallback={<div>Loading...</div>}><CertificatesContent /></Suspense> )
}
