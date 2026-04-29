'use client'
import { useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Loader2, X } from 'lucide-react'
import { AI_MODELS, compressImage } from '@/lib/certificateUpload'
import { extractCertPolicy, normalizeText, resolveExpiryDate } from '@/lib/certificates'
import { CertificateScanReview } from '@/components/certificates/CertificateScanReview'
import { CertificateUploadDropzone } from '@/components/certificates/CertificateUploadDropzone'

const isCrewActive = (crew: any) => crew?.is_active !== false && !crew?.resigned_at

function UploadContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const certName = searchParams.get('cert') || ''
  const targetCrewId = searchParams.get('crewId')

  const [user, setUser] = useState<any>(null)
  const [targetCrew, setTargetCrew] = useState<any>(null)
  const [certPolicy, setCertPolicy] = useState({ refreshYears: null as number | null, noExpiry: false })

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [activeModelLabel, setActiveModelLabel] = useState('')
  const [scanResult, setScanResult] = useState<any>(null)
  const [finalData, setFinalData] = useState({ issueDate: '', expiryDate: '' })

  useEffect(() => {
    const localUser = JSON.parse(localStorage.getItem('kmt_user') || 'null')
    if (!localUser) {
      router.replace('/login')
      return
    }
    setUser(localUser)
  }, [router])

  useEffect(() => {
    let active = true

    const loadContext = async () => {
      if (!user || !certName) return

      const crewPromise = targetCrewId
        ? supabase.from('crews').select('*').eq('id', targetCrewId).maybeSingle()
        : Promise.resolve({ data: user, error: null })

      const certMasterPromise = supabase.from('cert_master').select('*')

      const [crewRes, certMasterRes] = await Promise.all([crewPromise, certMasterPromise])
      if (!active) return

      const resolvedCrew = crewRes.data || user
      if (!isCrewActive(resolvedCrew)) {
        toast.error('This crew is marked as resigned')
        router.replace('/certificates')
        return
      }

      setTargetCrew(resolvedCrew)

      const matchedMasterRow =
        certMasterRes.data?.find((row: any) => normalizeText(row.cert_name) === normalizeText(certName)) ||
        certMasterRes.data?.find((row: any) => normalizeText(row.cert_name).includes(normalizeText(certName)) || normalizeText(certName).includes(normalizeText(row.cert_name))) ||
        null

      setCertPolicy(extractCertPolicy(matchedMasterRow))
    }

    loadContext()
    return () => {
      active = false
    }
  }, [user, certName, targetCrewId, router])

  const canSave = useMemo(() => {
    if (!file || !finalData.issueDate || !finalData.expiryDate) return false
    if (!scanResult) return false
    return scanResult.personNameMatch && scanResult.certTypeMatch
  }, [file, finalData, scanResult])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected || !targetCrew) return

    setFile(selected)
    setScanResult(null)

    const isPdf = selected.type === 'application/pdf'
    if (isPdf) {
      setPreview(null)
    } else {
      const reader = new FileReader()
      reader.onloadend = () => setPreview(reader.result as string)
      reader.readAsDataURL(selected)
    }

    setIsScanning(true)
    try {
      let base64 = ''
      const mimeType = isPdf ? 'application/pdf' : 'image/jpeg'

      if (isPdf) {
        base64 = await new Promise((resolve) => {
          const reader = new FileReader()
          reader.readAsDataURL(selected)
          reader.onloadend = () => resolve(reader.result as string)
        })
      } else {
        base64 = await compressImage(selected)
      }

      let latestError = 'AI models busy'
      for (const model of AI_MODELS) {
        setActiveModelLabel(`Trying: ${model.label}`)

        try {
          const res = await fetch('/api/ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: base64,
              mimeType,
              certName,
              crewName: targetCrew.full_name,
              modelId: model.id,
              provider: model.provider,
              refreshYears: certPolicy.refreshYears,
              noExpiry: certPolicy.noExpiry,
            }),
          })

          const result = await res.json()
          if (!res.ok || result.error) {
            latestError = result.error || latestError
            throw new Error(latestError)
          }

          const resolvedExpiry = resolveExpiryDate({
            issueDate: result.issueDate,
            expiryDate: result.expiryDate,
            refreshYears: certPolicy.refreshYears,
            noExpiry: certPolicy.noExpiry,
          })

          setScanResult(result)
          setFinalData({
            issueDate: result.issueDate || '',
            expiryDate: resolvedExpiry || '',
          })
          setActiveModelLabel(`Analyzed by: ${model.label}`)
          return
        } catch (error: any) {
          latestError = error.message || latestError
        }
      }

      throw new Error(latestError)
    } catch (error: any) {
      toast.error(error.message || 'AI validation failed')
      setActiveModelLabel('Manual review required')
    } finally {
      setIsScanning(false)
    }
  }

  const handleSave = async () => {
    if (!user || !targetCrew) return
    if (!canSave) {
      toast.error('AI validation must pass before saving this certificate')
      return
    }

    setIsSaving(true)
    try {
      let fileToUpload: Blob = file as File
      if (file && !file.type.includes('pdf') && preview) {
        const { jsPDF } = await import('jspdf')
        const pdf = new jsPDF()
        const imgProps = pdf.getImageProperties(preview)
        const pdfWidth = pdf.internal.pageSize.getWidth()
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width
        pdf.addImage(preview, 'JPEG', 0, 0, pdfWidth, pdfHeight)
        fileToUpload = pdf.output('blob')
      }

      const safeCrewName = String(targetCrew.full_name || 'crew').replace(/[^a-zA-Z0-9]/g, '_')
      const safeCertName = certName.replace(/[^a-zA-Z0-9]/g, '_')
      const filePath = `${safeCrewName}/${safeCertName}_${Date.now()}.pdf`

      const { error: storageError } = await supabase.storage.from('crew-certificates').upload(filePath, fileToUpload)
      if (storageError) throw storageError

      const { data: publicData } = supabase.storage.from('crew-certificates').getPublicUrl(filePath)
      const expiryDate = resolveExpiryDate({
        issueDate: finalData.issueDate,
        expiryDate: finalData.expiryDate,
        refreshYears: certPolicy.refreshYears,
        noExpiry: certPolicy.noExpiry,
      })

      const { error: dbError } = await supabase.from('crew_certs').upsert(
        {
          crew_id: targetCrew.id || user.id,
          cert_name: certName,
          issue_date: finalData.issueDate,
          expiry_date: expiryDate,
          file_url: publicData.publicUrl,
        },
        { onConflict: 'crew_id,cert_name' },
      )

      if (dbError) throw dbError

      toast.success('Certificate saved successfully')
      router.push('/certificates')
    } catch (error: any) {
      toast.error(error.message || 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-xl mx-auto pb-32 pt-20 font-sans">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-black uppercase italic tracking-tighter">Upload Cert</h1>
          <p className="text-blue-500 font-bold text-[10px] uppercase mt-1">{certName}</p>
          {targetCrew?.full_name && <p className="text-slate-500 text-[10px] mt-2 uppercase">Crew: {targetCrew.full_name}</p>}
        </div>
        <button onClick={() => router.push('/certificates')} className="p-2 bg-white/5 rounded-full">
          <X size={20} />
        </button>
      </div>

      <div className="space-y-6">
        <CertificateUploadDropzone file={file} preview={preview} onFileChange={handleFileChange} />

        {isScanning && (
          <div className="flex flex-col items-center justify-center gap-3 p-8 bg-blue-600/5 border border-blue-500/10 rounded-[32px] animate-pulse">
            <Loader2 className="animate-spin text-blue-500" />
            <p className="text-xs font-black text-blue-400 uppercase tracking-widest text-center">{activeModelLabel}</p>
          </div>
        )}

        {file && !isScanning && (
          <CertificateScanReview
            canSave={canSave}
            certPolicy={certPolicy}
            finalData={finalData}
            isSaving={isSaving}
            scanResult={scanResult}
            onFinalDataChange={setFinalData}
            onSave={handleSave}
          />
        )}
      </div>
    </div>
  )
}

export default function UploadCertPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <UploadContent />
    </Suspense>
  )
}
