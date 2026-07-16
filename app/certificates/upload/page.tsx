'use client'
import { useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, X } from 'lucide-react'
import { compressImage } from '@/lib/certificateUpload'
import { fetchAiModels } from '@/lib/aiModels'
import { extractCertPolicy, matchCertMasterRow, normalizeThaiDigits, resolveExpiryDate } from '@/lib/certificates'
import { CertificateScanReview } from '@/components/certificates/CertificateScanReview'
import { CertificateUploadDropzone } from '@/components/certificates/CertificateUploadDropzone'

const isCrewActive = (crew: any) => crew?.is_active !== false && !crew?.resigned_at
const isPassportCertificate = (value: string) => value.toLowerCase().includes('passport')
const isImageUpload = (input: File) =>
  input.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(input.name)

const readFileAsDataUrl = (input: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read certificate image'))
    reader.readAsDataURL(input)
  })

const normalizeImageDataUrlForPdf = (imageDataUrl: string) =>
  new Promise<string>((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth || image.width
      canvas.height = image.naturalHeight || image.height
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('Could not prepare certificate image'))
        return
      }

      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0)
      resolve(canvas.toDataURL('image/jpeg', 0.92))
    }
    image.onerror = () => reject(new Error('Could not open certificate image'))
    image.src = imageDataUrl
  })

const convertImageToPdfBlob = async (input: File) => {
  const imageDataUrl = await normalizeImageDataUrlForPdf(await readFileAsDataUrl(input))
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 24
  const imgProps = pdf.getImageProperties(imageDataUrl)
  const ratio = Math.min((pageWidth - margin * 2) / imgProps.width, (pageHeight - margin * 2) / imgProps.height)
  const imgWidth = imgProps.width * ratio
  const imgHeight = imgProps.height * ratio

  pdf.addImage(imageDataUrl, 'JPEG', (pageWidth - imgWidth) / 2, (pageHeight - imgHeight) / 2, imgWidth, imgHeight)
  return pdf.output('blob')
}

const normalizePassportCvData = (value: any) => ({
  nationalIdNo: normalizeThaiDigits(String(value?.nationalIdNo || '').trim()),
  nationality: String(value?.nationality || '').trim(),
  dateOfBirth: String(value?.dateOfBirth || '').trim(),
  placeOfBirth: String(value?.placeOfBirth || '').trim(),
})

function UploadContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const certName = searchParams.get('cert') || ''
  const targetCrewId = searchParams.get('crewId')

  const [user, setUser] = useState<any>(null)
  const [targetCrew, setTargetCrew] = useState<any>(null)
  const [certPolicy, setCertPolicy] = useState({ refreshYears: null as number | null, noExpiry: false })
  const [certMasterRows, setCertMasterRows] = useState<any[]>([])
  const [canonicalCertName, setCanonicalCertName] = useState('')

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [activeModelLabel, setActiveModelLabel] = useState('')
  const [scanResult, setScanResult] = useState<any>(null)
  const [finalData, setFinalData] = useState({ issueDate: '', expiryDate: '', certNumber: '', placeOfIssue: '', issueAuthority: '' })
  const [passportCvData, setPassportCvData] = useState({
    nationalIdNo: '',
    nationality: '',
    dateOfBirth: '',
    placeOfBirth: '',
  })

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
      setCertMasterRows(certMasterRes.data || [])

      const matchedMasterRow = matchCertMasterRow(certMasterRes.data || [], certName)
      const extractedPolicy = extractCertPolicy(matchedMasterRow)
      setCertPolicy(extractedPolicy)
      setCanonicalCertName(String(matchedMasterRow?.cert_name || certName).trim())
    }

    loadContext()
    return () => {
      active = false
    }
  }, [user, certName, targetCrewId, router])

  useEffect(() => {
    if (!scanResult || !finalData.issueDate) return
    if (scanResult.expiryFoundInDocument && finalData.expiryDate) return

    const resolvedExpiry = resolveExpiryDate({
      issueDate: finalData.issueDate,
      expiryDate: '',
      refreshYears: certPolicy.refreshYears,
      noExpiry: certPolicy.noExpiry,
    })

    if (!resolvedExpiry || resolvedExpiry === finalData.expiryDate) return

    setFinalData((prev) => ({ ...prev, expiryDate: resolvedExpiry }))
  }, [certPolicy.noExpiry, certPolicy.refreshYears, finalData.expiryDate, finalData.issueDate, scanResult])

  const effectiveExpiryDate = useMemo(
    () =>
      resolveExpiryDate({
        issueDate: finalData.issueDate,
        expiryDate: finalData.expiryDate,
        refreshYears: certPolicy.refreshYears,
        noExpiry: certPolicy.noExpiry,
      }),
    [certPolicy.noExpiry, certPolicy.refreshYears, finalData.expiryDate, finalData.issueDate],
  )

  const canSave = useMemo(() => {
    if (!file || !finalData.issueDate || !effectiveExpiryDate) return false
    if (!scanResult) return false
    return scanResult.personNameMatch && scanResult.certTypeMatch
  }, [effectiveExpiryDate, file, finalData.issueDate, scanResult])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected || !targetCrew) return

    setFile(selected)
    setScanResult(null)
    setPassportCvData({ nationalIdNo: '', nationality: '', dateOfBirth: '', placeOfBirth: '' })

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
      const aiModels = await fetchAiModels('crew_certificate')
      for (const model of aiModels) {
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
              modelId: model.modelId,
              provider: model.provider,
              modelUseCase: 'crew_certificate',
              refreshYears: certPolicy.refreshYears,
              noExpiry: certPolicy.noExpiry,
            }),
          })

          const result = await res.json()
          if (!res.ok || result.error) {
            latestError = result.error || latestError
            throw new Error(latestError)
          }

          const matchedPolicyRow = matchCertMasterRow(certMasterRows, certName, result.detectedCertName)
          const extractedPolicy = extractCertPolicy(matchedPolicyRow)
          const resolvedPolicy = extractedPolicy
          const resolvedCertName = String(matchedPolicyRow?.cert_name || canonicalCertName || certName).trim()

          const resolvedExpiry = resolveExpiryDate({
            issueDate: result.issueDate,
            expiryDate: result.expiryDate,
            refreshYears: resolvedPolicy.refreshYears,
            noExpiry: resolvedPolicy.noExpiry,
          })

          setCertPolicy(resolvedPolicy)
          setCanonicalCertName(resolvedCertName)
          setScanResult(result)
          setPassportCvData(normalizePassportCvData(result.passportCvData))
          setFinalData({
            issueDate: result.issueDate || '',
            expiryDate: resolvedExpiry || '',
            certNumber: normalizeThaiDigits(String(result.certNumber || '').trim()),
            placeOfIssue: String(result.placeOfIssue || '').trim(),
            issueAuthority: String(result.issueAuthority || '').trim(),
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
      if (file && isImageUpload(file)) {
        fileToUpload = await convertImageToPdfBlob(file)
      }

      const selectedCertName = String(canonicalCertName || certName).trim()
      let matchedSaveRow =
        matchCertMasterRow(certMasterRows, certName) ||
        matchCertMasterRow(certMasterRows, selectedCertName)

      if (!matchedSaveRow) {
        const { data: freshCertMasterRows, error: freshCertMasterError } = await supabase.from('cert_master').select('*')
        if (freshCertMasterError) throw freshCertMasterError
        const freshRows = freshCertMasterRows || []
        setCertMasterRows(freshRows)
        matchedSaveRow =
          matchCertMasterRow(freshRows, certName) ||
          matchCertMasterRow(freshRows, selectedCertName)
      }

      const savedCertName = String(matchedSaveRow?.cert_name || '').trim()
      if (!savedCertName) {
        toast.error('Certificate master record not found. Please check cert_master name.')
        return
      }

      const safeCrewName = String(targetCrew.full_name || 'crew').replace(/[^a-zA-Z0-9]/g, '_')
      const safeCertName = savedCertName.replace(/[^a-zA-Z0-9]/g, '_')
      const filePath = `${safeCrewName}/${safeCertName}_${Date.now()}.pdf`

      const { error: storageError } = await supabase.storage
        .from('crew-certificates')
        .upload(filePath, fileToUpload, { contentType: 'application/pdf' })
      if (storageError) throw storageError

      const { data: publicData } = supabase.storage.from('crew-certificates').getPublicUrl(filePath)
      const expiryDate = effectiveExpiryDate
      if (!expiryDate) {
        toast.error('Expiry date is required or must be derivable from cert master policy')
        return
      }
      if (expiryDate !== finalData.expiryDate) {
        setFinalData((prev) => ({ ...prev, expiryDate }))
      }
      const normalizedCertNumber = normalizeThaiDigits(finalData.certNumber || '')

      const { error: dbError } = await supabase.from('crew_certs').upsert(
        {
          crew_id: targetCrew.id || user.id,
          cert_name: savedCertName,
          issue_date: finalData.issueDate,
          expiry_date: expiryDate,
          cert_number: normalizedCertNumber || null,
          place_of_issue: finalData.placeOfIssue || null,
          issue_authority: finalData.issueAuthority || null,
          file_url: publicData.publicUrl,
        },
        { onConflict: 'crew_id,cert_name' },
      )

      if (dbError) throw dbError
      const normalizedPassportData = normalizePassportCvData(passportCvData)
      const passportUpdate: Record<string, string> = {}
      if (isPassportCertificate(savedCertName)) {
        if (normalizedPassportData.nationalIdNo) passportUpdate.national_id_no = normalizedPassportData.nationalIdNo
        if (normalizedPassportData.nationality) passportUpdate.nationality = normalizedPassportData.nationality
        if (normalizedPassportData.dateOfBirth) passportUpdate.date_of_birth = normalizedPassportData.dateOfBirth
        if (normalizedPassportData.placeOfBirth) passportUpdate.place_of_birth = normalizedPassportData.placeOfBirth
        if (Object.keys(passportUpdate).length > 0) {
          passportUpdate.passport_cv_updated_at = new Date().toISOString()
          const { error: passportError } = await supabase
            .from('crews')
            .update(passportUpdate)
            .eq('id', targetCrew.id || user.id)

          if (passportError && !String(passportError.message || '').toLowerCase().includes('column')) {
            throw passportError
          }
        }
      }

      await supabase.from('crew_cert_history').insert({
        crew_id: targetCrew.id || user.id,
        cert_name: savedCertName,
        action: 'upload_certificate',
        old_data: null,
        new_data: {
          crew_id: targetCrew.id || user.id,
          crew_name: targetCrew.full_name || user.full_name,
          cert_name: savedCertName,
          issue_date: finalData.issueDate,
          expiry_date: expiryDate,
          cert_number: normalizedCertNumber || null,
          place_of_issue: finalData.placeOfIssue || null,
          issue_authority: finalData.issueAuthority || null,
          file_url: publicData.publicUrl,
          passport_cv_data: isPassportCertificate(savedCertName) ? normalizedPassportData : null,
        },
        actor_name: user.full_name || user.position || 'Unknown user',
      })

      toast.success('Certificate saved successfully')
      router.push('/certificates')
    } catch (error: any) {
      toast.error(error.message || 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-xl mx-auto pb-32 pt-6 font-sans md:pt-20">
      <button
        onClick={() => router.push('/certificates')}
        className="mb-5 inline-flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--subtle)] shadow-[0_12px_28px_rgba(80,52,16,0.08)] md:hidden"
      >
        <ArrowLeft size={14} />
        Certificates
      </button>
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
            isPassport={isPassportCertificate(certName)}
            passportCvData={passportCvData}
            scanResult={scanResult}
            onFinalDataChange={setFinalData}
            onPassportCvDataChange={setPassportCvData}
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
