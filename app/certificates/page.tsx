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
import { ExternalLink, Loader2, Mail, Save, Search, ShieldCheck } from 'lucide-react'

const normalize = (str: string) => String(str || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();
const isCrewActive = (crew: any) => crew?.is_active !== false && !crew?.resigned_at;

type CertificateLogRow = {
  id: string
  action: string | null
  old_data: Record<string, any> | null
  new_data: Record<string, any> | null
  actor_name: string | null
  created_at: string | null
}

type CrewCertificateLogRow = CertificateLogRow & {
  crew_id?: string | null
  cert_name?: string | null
}

type UnifiedCertificateLogRow = CertificateLogRow & {
  source: 'crew' | 'ship'
  subject: string
  file_url?: string | null
}

type CertEmailSettings = {
  id: string
  ship_alert_enabled: boolean
  my_cert_alert_enabled: boolean
  ship_to_emails: string[] | null
  ship_cc_emails: string[] | null
}

type CertEmailLogRow = {
  id: string
  alert_type: string | null
  scope: string | null
  trigger_label: string | null
  recipient: string | null
  cc: string[] | null
  subject: string | null
  status: string | null
  error_message: string | null
  crew_name: string | null
  related_cert_count: number | null
  sent_at: string | null
  created_at: string | null
}

const formatLogDate = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

const getLogCertificate = (row: CertificateLogRow) => row.new_data || row.old_data || {}

const getLogActionLabel = (action?: string | null) => {
  const labels: Record<string, string> = {
    add_certificate: 'Added',
    renew_upload: 'Renewed / Uploaded',
    manual_update: 'Edited',
    delete_certificate: 'Deleted',
    upload_certificate: 'Uploaded',
    current_upload: 'Current Upload',
  }
  return labels[String(action || '')] || String(action || 'Updated').replace(/_/g, ' ')
}

const getLogActionStyle = (action?: string | null) => {
  if (action === 'delete_certificate') return 'border-red-500/30 bg-red-500/10 text-red-200'
  if (['renew_upload', 'upload_certificate', 'current_upload'].includes(String(action))) return 'border-orange-400/30 bg-orange-500/10 text-orange-200'
  if (action === 'add_certificate') return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
  return 'border-white/10 bg-white/5 text-zinc-300'
}

const certificateTabCopy: Record<string, { title: string; subtitle: string }> = {
  personal: {
    title: 'My Certificate',
    subtitle: 'Personal compliance dashboard',
  },
  crew: {
    title: 'Crew Certificate',
    subtitle: 'Fleet readiness by crew matrix',
  },
  log: {
    title: 'Certificate Log',
    subtitle: 'Ship certificate activity audit',
  },
}

const crewColumns = 'id, full_name, position, is_active, resigned_at'
const crewCertColumns = 'id, crew_id, cert_name, issue_date, expiry_date, file_url, created_at, updated_at'
const certLogColumns = 'id, action, old_data, new_data, actor_name, created_at'
const crewCertLogColumns = 'id, action, old_data, new_data, actor_name, created_at, crew_id, cert_name'
const certEmailSettingsColumns = 'id, ship_alert_enabled, my_cert_alert_enabled, ship_to_emails, ship_cc_emails'
const certEmailLogColumns = 'id, alert_type, scope, trigger_label, recipient, cc, subject, status, error_message, crew_name, related_cert_count, sent_at, created_at'

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
  const [certificateLogs, setCertificateLogs] = useState<CertificateLogRow[]>([])
  const [crewCertificateLogs, setCrewCertificateLogs] = useState<CrewCertificateLogRow[]>([])
  const [certEmailSettings, setCertEmailSettings] = useState<CertEmailSettings | null>(null)
  const [certEmailLogs, setCertEmailLogs] = useState<CertEmailLogRow[]>([])
  
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
    const [m, c, crewsRes, allC, r, logs, crewLogs, emailSettings, emailLogs] = await Promise.all([
      supabase.from('cert_matrix').select('*'),
      supabase.from('crew_certs').select(crewCertColumns).eq('crew_id', currentUser?.id),
      supabase.from('crews').select(crewColumns).order('full_name'),
      supabase.from('crew_certs').select(crewCertColumns),
      supabase.from('cert_rules').select('*'),
      supabase.from('ship_cert_history').select(certLogColumns).order('created_at', { ascending: false }).limit(50),
      supabase.from('crew_cert_history').select(crewCertLogColumns).order('created_at', { ascending: false }).limit(100),
      supabase.from('cert_email_settings').select(certEmailSettingsColumns).eq('id', 'default').maybeSingle(),
      supabase.from('cert_email_logs').select(certEmailLogColumns).order('created_at', { ascending: false }).limit(150),
    ]);
    if (m.data) setMatrix(m.data);
    if (c.data) setMyCerts(c.data);
    if (crewsRes.data) setCrews(crewsRes.data.filter(isCrewActive));
    if (allC.data) setAllCerts(allC.data);
    if (r.data) setRules(r.data);
    if (logs.data) setCertificateLogs(logs.data as unknown as CertificateLogRow[]);
    if (crewLogs.data) setCrewCertificateLogs(crewLogs.data as unknown as CrewCertificateLogRow[]);
    if (emailSettings.data) setCertEmailSettings(emailSettings.data as unknown as CertEmailSettings);
    if (emailLogs.data) setCertEmailLogs(emailLogs.data as unknown as CertEmailLogRow[]);
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
    if (tab === 'log' && canManageCertificates) setActiveTab('log')
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

  const headerCopy = certificateTabCopy[activeTab] || certificateTabCopy.personal

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-32 pt-28 font-sans text-white uppercase font-bold text-[10px]">
      
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           <h1 className="text-3xl md:text-4xl font-black italic flex items-center gap-3"><ShieldCheck className="text-orange-500" size={36}/> {headerCopy.title}</h1>
           <p className="text-zinc-500 mt-1 tracking-widest">{headerCopy.subtitle}</p>
        </div>
        
        {canManageCertificates && (
          <div className="grid w-full max-w-2xl grid-cols-4 rounded-[30px] border border-orange-500/20 bg-black/40 p-1.5 text-[10px] font-black uppercase tracking-tight text-zinc-500 shadow-2xl backdrop-blur md:w-[720px]">
            <button onClick={() => setActiveTab('personal')} className={`rounded-[22px] px-4 py-4 transition-all ${activeTab === 'personal' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/25' : 'hover:bg-white/5 hover:text-white'}`}>My Certificate</button>
            <button onClick={() => setActiveTab('crew')} className={`rounded-[22px] px-4 py-4 transition-all ${activeTab === 'crew' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/25' : 'hover:bg-white/5 hover:text-white'}`}>Crew Certificate</button>
            {canOpenShipCertificates && <button onClick={() => router.push('/admin/ship-certificates')} className="rounded-[22px] px-4 py-4 transition-all hover:bg-white/5 hover:text-white">Ship Certificate</button>}
            <button onClick={() => setActiveTab('log')} className={`rounded-[22px] px-4 py-4 transition-all ${activeTab === 'log' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/25' : 'hover:bg-white/5 hover:text-white'}`}>Certificate Log</button>
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

      {activeTab === 'log' && canManageCertificates && (
        <CertificateLogPanel
          crewCertRows={allCerts}
          crewRows={crews}
          crewRowsFromHistory={crewCertificateLogs}
          shipRows={certificateLogs}
          emailSettings={certEmailSettings}
          emailLogs={certEmailLogs}
          onRefresh={fetchData}
        />
      )}
    </div>
  )
}

function CertificateLogPanel({
  crewCertRows,
  crewRows,
  crewRowsFromHistory,
  shipRows,
  emailSettings,
  emailLogs,
  onRefresh,
}: {
  crewCertRows: any[]
  crewRows: any[]
  crewRowsFromHistory: CrewCertificateLogRow[]
  shipRows: CertificateLogRow[]
  emailSettings: CertEmailSettings | null
  emailLogs: CertEmailLogRow[]
  onRefresh: () => Promise<void>
}) {
  const [logTab, setLogTab] = useState<'activity' | 'email'>('activity')
  const [typeFilter, setTypeFilter] = useState<'all' | 'crew' | 'ship'>('all')
  const [certFilter, setCertFilter] = useState('all')
  const [userSearch, setUserSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState('all')
  const [shipToInput, setShipToInput] = useState('')
  const [shipCcInput, setShipCcInput] = useState('')
  const [shipEnabled, setShipEnabled] = useState(true)
  const [savingEmailSettings, setSavingEmailSettings] = useState(false)

  useEffect(() => {
    if (!emailSettings) return
    setShipToInput((emailSettings.ship_to_emails || []).join(', '))
    setShipCcInput((emailSettings.ship_cc_emails || []).join(', '))
    setShipEnabled(emailSettings.ship_alert_enabled !== false)
  }, [emailSettings])

  const rows = useMemo<UnifiedCertificateLogRow[]>(() => {
    const crewNameById = new Map(crewRows.map((crew) => [crew.id, crew.full_name || 'Unknown crew']))
    const crewHistoryRows = crewRowsFromHistory.map((row) => {
      const cert = getLogCertificate(row)
      const crewId = row.crew_id || cert.crew_id
      const subject = cert.crew_name || crewNameById.get(crewId) || 'Unknown crew'
      return {
        ...row,
        id: `crew-history-${row.id}`,
        source: 'crew' as const,
        subject,
        file_url: cert.file_url || null,
      }
    })

    const hasHistoryFor = new Set(crewHistoryRows.map((row) => {
      const cert = getLogCertificate(row)
      return `${cert.crew_id || ''}:${cert.cert_name || ''}`
    }))
    const fallbackCrewRows = crewCertRows
      .filter((cert) => !hasHistoryFor.has(`${cert.crew_id || ''}:${cert.cert_name || ''}`))
      .map((cert) => {
        const crewName = crewNameById.get(cert.crew_id) || 'Unknown crew'
        return {
          id: `crew-current-${cert.id}`,
          source: 'crew' as const,
          action: 'current_upload',
          old_data: null,
          new_data: {
            ...cert,
            crew_name: crewName,
          },
          actor_name: crewName,
          created_at: cert.updated_at || cert.created_at || null,
          subject: crewName,
          file_url: cert.file_url || null,
        }
      })
    const mappedShipRows = shipRows.map((row) => {
      const cert = getLogCertificate(row)
      return {
        ...row,
        id: `ship-${row.id}`,
        source: 'ship' as const,
        subject: cert.vessel_name || 'Kamala Thanee',
        file_url: cert.file_url || null,
      }
    })

    return [...crewHistoryRows, ...fallbackCrewRows, ...mappedShipRows].sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
      return bTime - aTime
    })
  }, [crewCertRows, crewRows, crewRowsFromHistory, shipRows])

  const actionOptions = useMemo(() => {
    return ['all', ...Array.from(new Set(rows.map((row) => row.action).filter(Boolean) as string[]))]
  }, [rows])

  const certOptions = useMemo(() => {
    return ['all', ...Array.from(new Set(rows.map((row) => {
      const cert = getLogCertificate(row)
      return [cert.code, cert.cert_name].filter(Boolean).join(' | ')
    }).filter(Boolean))).sort()]
  }, [rows])

  const monthOptions = useMemo(() => {
    return ['all', ...Array.from(new Set(rows.map((row) => {
      if (!row.created_at) return ''
      const date = new Date(row.created_at)
      if (Number.isNaN(date.getTime())) return ''
      return String(date.getMonth() + 1).padStart(2, '0')
    }).filter(Boolean))).sort()]
  }, [rows])

  const yearOptions = useMemo(() => {
    return ['all', ...Array.from(new Set(rows.map((row) => {
      if (!row.created_at) return ''
      const date = new Date(row.created_at)
      if (Number.isNaN(date.getTime())) return ''
      return String(date.getFullYear())
    }).filter(Boolean))).sort((a, b) => b.localeCompare(a))]
  }, [rows])

  const filteredRows = useMemo(() => {
    const userQuery = userSearch.trim().toLowerCase()
    return rows.filter((row) => {
      const cert = getLogCertificate(row)
      const date = row.created_at ? new Date(row.created_at) : null
      const month = date && !Number.isNaN(date.getTime()) ? String(date.getMonth() + 1).padStart(2, '0') : ''
      const year = date && !Number.isNaN(date.getTime()) ? String(date.getFullYear()) : ''
      const certLabel = [cert.code, cert.cert_name].filter(Boolean).join(' | ')
      const certQuery = certFilter.toLowerCase()
      const userText = [row.actor_name, row.subject, cert.crew_name, cert.issue_by].filter(Boolean).join(' ').toLowerCase()

      return (
        (typeFilter === 'all' || row.source === typeFilter) &&
        (certFilter === 'all' || certLabel.toLowerCase().includes(certQuery)) &&
        (!userQuery || userText.includes(userQuery)) &&
        (actionFilter === 'all' || row.action === actionFilter) &&
        (monthFilter === 'all' || month === monthFilter) &&
        (yearFilter === 'all' || year === yearFilter)
      )
    })
  }, [actionFilter, certFilter, monthFilter, rows, typeFilter, userSearch, yearFilter])

  const parseEmails = (value: string) =>
    Array.from(new Set(String(value || '').split(/[,\n;]/).map((item) => item.trim()).filter(Boolean)))

  const saveEmailSettings = async () => {
    setSavingEmailSettings(true)
    try {
      const { error } = await supabase.from('cert_email_settings').upsert({
        id: 'default',
        ship_alert_enabled: shipEnabled,
        my_cert_alert_enabled: true,
        ship_to_emails: parseEmails(shipToInput),
        ship_cc_emails: parseEmails(shipCcInput),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      if (error) throw error
      toast.success('Certificate email settings saved')
      await onRefresh()
    } catch (error: any) {
      toast.error(error?.message || 'Unable to save email settings')
    } finally {
      setSavingEmailSettings(false)
    }
  }

  return (
    <section className="space-y-5">
      <div className="grid w-full max-w-md grid-cols-2 rounded-[26px] border border-orange-500/20 bg-black/40 p-1.5 text-[10px] font-black uppercase tracking-tight text-zinc-500">
        {([
          { value: 'activity', label: 'Cert Activity' },
          { value: 'email', label: 'Email Log' },
        ] as const).map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setLogTab(option.value)}
            className={`rounded-[20px] px-4 py-3 transition-all ${logTab === option.value ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/25' : 'hover:bg-white/5 hover:text-white'}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {logTab === 'email' && (
        <section className="space-y-5">
          <div className="rounded-[34px] border border-orange-500/20 bg-black/40 p-5">
            <div className="mb-4 flex items-center gap-3 text-orange-300">
              <Mail size={18} />
              <h3 className="text-sm font-black uppercase tracking-[0.25em]">Certificate Email Settings</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Ship Cert To Emails</span>
                <textarea
                  value={shipToInput}
                  onChange={(event) => setShipToInput(event.target.value)}
                  placeholder="radio@company.com, vessel@company.com"
                  className="min-h-[96px] w-full rounded-2xl border border-orange-500/20 bg-black/60 p-4 text-sm font-bold text-white outline-none placeholder:text-zinc-700"
                />
              </label>
              <label className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Ship Cert CC Emails</span>
                <textarea
                  value={shipCcInput}
                  onChange={(event) => setShipCcInput(event.target.value)}
                  placeholder="office@company.com"
                  className="min-h-[96px] w-full rounded-2xl border border-orange-500/20 bg-black/60 p-4 text-sm font-bold text-white outline-none placeholder:text-zinc-700"
                />
              </label>
            </div>
            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-300">
                  <input type="checkbox" checked={shipEnabled} onChange={(event) => setShipEnabled(event.target.checked)} />
                  Ship Cert Alerts
                </label>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-500">
                  My Cert emails auto-send to each crew email
                </div>
              </div>
              <button
                onClick={saveEmailSettings}
                disabled={savingEmailSettings}
                className="rounded-2xl bg-orange-600 px-6 py-4 text-xs font-black uppercase tracking-widest text-white disabled:opacity-50"
              >
                {savingEmailSettings ? <Loader2 size={15} className="mr-2 inline animate-spin" /> : <Save size={15} className="mr-2 inline" />}
                Save Email Settings
              </button>
            </div>
          </div>

          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
            {emailLogs.length} email log records
          </p>

          <div className="space-y-3">
            {emailLogs.length === 0 ? (
              <div className="rounded-[34px] border border-white/10 bg-black/30 p-12 text-center text-sm font-black uppercase tracking-widest text-zinc-600">
                No certificate email log yet
              </div>
            ) : emailLogs.map((log) => (
              <article key={log.id} className="grid gap-4 rounded-[28px] border border-white/10 bg-black/40 p-5 md:grid-cols-[180px_1fr_150px] md:items-center">
                <div>
                  <span className={`inline-flex rounded-full border px-3 py-2 text-[8px] font-black uppercase tracking-widest ${log.status === 'sent' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : log.status === 'failed' ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300'}`}>
                    {log.status || 'pending'}
                  </span>
                  <p className="mt-2 text-[10px] font-bold normal-case text-zinc-500">{formatLogDate(log.sent_at || log.created_at)}</p>
                </div>
                <div>
                  <p className="text-sm font-black uppercase italic text-white">{log.subject || log.alert_type || 'Certificate email'}</p>
                  <p className="mt-1 text-[11px] font-bold normal-case text-zinc-500">
                    {log.scope || '-'} {log.trigger_label ? `| ${log.trigger_label}` : ''} | {log.related_cert_count || 0} cert(s)
                  </p>
                  <p className="mt-1 text-[11px] font-bold normal-case text-zinc-500">To: {log.recipient || '-'}</p>
                  {log.error_message && <p className="mt-2 text-[11px] font-bold text-red-300">{log.error_message}</p>}
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Crew</p>
                  <p className="mt-1 text-xs font-black normal-case text-zinc-200">{log.crew_name || '-'}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {logTab === 'activity' && (
        <>
      <div className="grid w-full max-w-lg grid-cols-3 rounded-[26px] border border-orange-500/20 bg-black/40 p-1.5 text-[10px] font-black uppercase tracking-tight text-zinc-500">
        {([
          { value: 'all', label: 'All' },
          { value: 'crew', label: 'Crew Cert' },
          { value: 'ship', label: 'Ship Cert' },
        ] as const).map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setTypeFilter(option.value)}
            className={`rounded-[20px] px-4 py-3 transition-all ${typeFilter === option.value ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/25' : 'hover:bg-white/5 hover:text-white'}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="rounded-[34px] border border-white/10 bg-black/30 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_170px_150px_150px]">
          <label className="flex items-center gap-3 rounded-2xl border border-orange-500/20 bg-black/40 px-4">
            <Search size={16} className="text-orange-500" />
            <input
              list="certificate-log-cert-options"
              value={certFilter === 'all' ? '' : certFilter}
              onChange={(event) => setCertFilter(event.target.value || 'all')}
              placeholder="Search or pick certificate..."
              className="h-14 w-full bg-transparent text-sm font-bold text-white outline-none placeholder:text-zinc-600"
            />
            <datalist id="certificate-log-cert-options">
              {certOptions.filter((cert) => cert !== 'all').map((cert) => (
                <option key={cert} value={cert} />
              ))}
            </datalist>
          </label>
          <input
            value={userSearch}
            onChange={(event) => setUserSearch(event.target.value)}
            placeholder="Search user..."
            className="h-14 rounded-2xl border border-orange-500/20 bg-black/60 px-4 text-xs font-black uppercase text-white outline-none placeholder:text-zinc-600"
          />
          <select
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
            className="h-14 rounded-2xl border border-orange-500/20 bg-black/60 px-4 text-xs font-black uppercase text-white outline-none"
          >
            {actionOptions.map((action) => (
              <option key={action} value={action}>{action === 'all' ? 'All Actions' : getLogActionLabel(action)}</option>
            ))}
          </select>
          <select
            value={monthFilter}
            onChange={(event) => setMonthFilter(event.target.value)}
            className="h-14 rounded-2xl border border-orange-500/20 bg-black/60 px-4 text-xs font-black uppercase text-white outline-none"
          >
            {monthOptions.map((month) => (
              <option key={month} value={month}>{month === 'all' ? 'All Months' : month}</option>
            ))}
          </select>
          <select
            value={yearFilter}
            onChange={(event) => setYearFilter(event.target.value)}
            className="h-14 rounded-2xl border border-orange-500/20 bg-black/60 px-4 text-xs font-black uppercase text-white outline-none"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>{year === 'all' ? 'All Years' : year}</option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
        {filteredRows.length} shown / {rows.length} log records
      </p>

      {filteredRows.length === 0 ? (
        <div className="rounded-[34px] border border-white/10 bg-black/30 p-12 text-center text-sm font-black uppercase tracking-widest text-zinc-600">
          No certificate log matches current filters
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRows.map((row) => {
            const cert = getLogCertificate(row)
            const fileUrl = cert.file_url
            return (
              <article key={row.id} className="grid gap-4 rounded-[28px] border border-white/10 bg-black/40 p-5 md:grid-cols-[170px_1fr_180px_120px] md:items-center">
                <div>
                  <span className={`inline-flex rounded-full border px-3 py-2 text-[8px] font-black uppercase tracking-widest ${getLogActionStyle(row.action)}`}>
                    {getLogActionLabel(row.action)}
                  </span>
                  <span className={`ml-2 inline-flex rounded-full border px-3 py-2 text-[8px] font-black uppercase tracking-widest ${row.source === 'crew' ? 'border-blue-400/30 bg-blue-500/10 text-blue-200' : 'border-orange-400/30 bg-orange-500/10 text-orange-200'}`}>
                    {row.source === 'crew' ? 'Crew Cert' : 'Ship Cert'}
                  </span>
                  <p className="mt-2 text-[10px] font-bold normal-case text-zinc-500">{formatLogDate(row.created_at)}</p>
                </div>
                <div>
                  <p className="text-sm font-black uppercase italic text-white">
                    {cert.code ? `${cert.code} | ` : ''}{cert.cert_name || 'Unknown certificate'}
                  </p>
                  <p className="mt-1 text-[11px] font-bold normal-case text-zinc-500">
                    {row.subject} {cert.expiry_date ? `| Exp ${cert.expiry_date}` : ''}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600">By</p>
                  <p className="mt-1 text-xs font-black normal-case text-zinc-200">{row.actor_name || 'Unknown user'}</p>
                </div>
                {fileUrl ? (
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-orange-200 hover:bg-orange-500/20"
                  >
                    <ExternalLink size={14} /> File
                  </a>
                ) : (
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-700">No file</span>
                )}
              </article>
            )
          })}
        </div>
      )}
        </>
      )}
    </section>
  )
}

export default function CertificatesPage() {
  return ( <Suspense fallback={<div>Loading...</div>}><CertificatesContent /></Suspense> )
}
