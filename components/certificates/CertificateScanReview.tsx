'use client'

import { useRef } from 'react'
import { AlertTriangle, CalendarDays, CheckCircle, Loader2 } from 'lucide-react'
import type { CertPolicy } from '@/lib/certificates'
import { resolveExpiryDate } from '@/lib/certificates'

type FinalCertData = {
  issueDate: string
  expiryDate: string
}

type CertificateScanReviewProps = {
  canSave: boolean
  certPolicy: CertPolicy
  finalData: FinalCertData
  isSaving: boolean
  scanResult: any
  onFinalDataChange: (updater: (previous: FinalCertData) => FinalCertData) => void
  onSave: () => void
}

export function CertificateScanReview({
  canSave,
  certPolicy,
  finalData,
  isSaving,
  scanResult,
  onFinalDataChange,
  onSave,
}: CertificateScanReviewProps) {
  return (
    <div className="bg-slate-900 border border-white/10 rounded-[40px] p-8 space-y-6 animate-in slide-in-from-bottom-4 shadow-2xl">
      <div className="grid grid-cols-2 gap-6">
        <CertDatePicker
          label="Issue Date"
          value={finalData.issueDate}
          onChange={(value) =>
            onFinalDataChange((prev) => ({
              ...prev,
              issueDate: value,
              expiryDate: scanResult?.expiryFoundInDocument
                ? prev.expiryDate
                : resolveExpiryDate({
                    issueDate: value,
                    expiryDate: '',
                    refreshYears: certPolicy.refreshYears,
                    noExpiry: certPolicy.noExpiry,
                  }),
            }))
          }
        />
        <CertDatePicker
          label="Expiry Date"
          value={finalData.expiryDate}
          onChange={(value) => onFinalDataChange((prev) => ({ ...prev, expiryDate: value }))}
        />
      </div>

      {scanResult && (
        <>
          <CertValidationPanel
            matched={scanResult.personNameMatch}
            passTitle="Crew Name Matched"
            failTitle="Crew Name Mismatch"
            detail={`Detected: ${scanResult.detectedPersonName || 'Unknown'}`}
          />
          <CertValidationPanel
            matched={scanResult.certTypeMatch}
            passTitle="Certificate Type Matched"
            failTitle="Certificate Type Mismatch"
            detail={`Detected: ${scanResult.detectedCertName || 'Unknown'}`}
          />

          <div className="p-5 rounded-3xl border border-white/10 bg-black/30">
            <p className="text-[10px] font-black uppercase text-white">AI Note</p>
            <p className="text-[10px] text-slate-400 font-bold leading-relaxed mt-2">{scanResult.note}</p>
            {scanResult.expiryDerivedFromPolicy && (
              <p className="text-[10px] text-amber-400 font-bold mt-3">
                Expiry was derived from `cert_master.refresh_years` / no-expiry policy because the document did not clearly provide one.
              </p>
            )}
            {certPolicy.noExpiry && <p className="text-[10px] text-blue-400 font-bold mt-3">This certificate is configured as no-expiry.</p>}
          </div>
        </>
      )}

      <button
        onClick={onSave}
        disabled={isSaving || !canSave}
        className="w-full py-5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-3xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 shadow-xl transition-all"
      >
        {isSaving ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
        Confirm & Save
      </button>
    </div>
  )
}

function CertDatePicker({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  const inputRef = useRef<HTMLInputElement>(null)

  const openPicker = () => {
    const input = inputRef.current
    if (!input) return
    if (typeof input.showPicker === 'function') {
      input.showPicker()
      return
    }
    input.focus()
  }

  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</label>
      <button
        type="button"
        onClick={openPicker}
        className="group relative w-full rounded-2xl border border-white/10 bg-black p-4 text-left font-bold text-white outline-none transition-all hover:border-orange-500/60 focus:border-orange-500"
      >
        <span className="flex items-center justify-between gap-3">
          <span>{value || 'Select date'}</span>
          <span className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-orange-400 group-hover:bg-orange-500/10">
            <CalendarDays size={14} />
            Pick
          </span>
        </span>
        <input
          ref={inputRef}
          type="date"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </button>
    </div>
  )
}

function CertValidationPanel({
  detail,
  failTitle,
  matched,
  passTitle,
}: {
  detail: string
  failTitle: string
  matched: boolean
  passTitle: string
}) {
  return (
    <div className={`p-5 rounded-3xl flex items-start gap-4 border ${matched ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
      {matched ? <CheckCircle className="text-emerald-500 shrink-0" /> : <AlertTriangle className="text-red-500 shrink-0" />}
      <div className="space-y-1">
        <p className="text-[10px] font-black uppercase text-white">{matched ? passTitle : failTitle}</p>
        <p className="text-[10px] text-slate-400 font-bold leading-relaxed">{detail}</p>
      </div>
    </div>
  )
}
