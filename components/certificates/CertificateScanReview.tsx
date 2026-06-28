'use client'

import { type Dispatch, type SetStateAction, useRef } from 'react'
import { AlertTriangle, CalendarDays, CheckCircle, Loader2 } from 'lucide-react'
import type { CertPolicy } from '@/lib/certificates'
import { normalizeThaiDigits, resolveExpiryDate } from '@/lib/certificates'

type FinalCertData = {
  issueDate: string
  expiryDate: string
  certNumber: string
  placeOfIssue: string
  issueAuthority: string
}

type PassportCvData = {
  nationalIdNo: string
  nationality: string
  dateOfBirth: string
  placeOfBirth: string
}

type CertificateScanReviewProps = {
  canSave: boolean
  certPolicy: CertPolicy
  finalData: FinalCertData
  isPassport?: boolean
  isSaving: boolean
  passportCvData?: PassportCvData
  scanResult: any
  onFinalDataChange: (updater: (previous: FinalCertData) => FinalCertData) => void
  onPassportCvDataChange?: Dispatch<SetStateAction<PassportCvData>>
  onSave: () => void
}

export function CertificateScanReview({
  canSave,
  certPolicy,
  finalData,
  isPassport = false,
  isSaving,
  passportCvData,
  scanResult,
  onFinalDataChange,
  onPassportCvDataChange,
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
      <div className="grid gap-4 md:grid-cols-3">
        <PassportCvInput
          label="Certificate No."
          value={finalData.certNumber || ''}
          onChange={(value) => onFinalDataChange((prev) => ({ ...prev, certNumber: normalizeThaiDigits(value) }))}
        />
        <PassportCvInput
          label="Place of Issue"
          value={finalData.placeOfIssue || ''}
          onChange={(value) => onFinalDataChange((prev) => ({ ...prev, placeOfIssue: value }))}
        />
        <PassportCvInput
          label="Issue Authority"
          value={finalData.issueAuthority || ''}
          onChange={(value) => onFinalDataChange((prev) => ({ ...prev, issueAuthority: value }))}
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

          {isPassport && passportCvData && onPassportCvDataChange && (
            <div className="rounded-3xl border border-orange-500/20 bg-orange-500/10 p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-orange-400">Passport CV Fields</p>
              <p className="mt-1 text-[10px] font-bold normal-case text-slate-400">
                These fields will prefill the future CV profile. Review and edit before saving.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <PassportCvInput
                  label="National ID No."
                  value={passportCvData.nationalIdNo}
                  onChange={(value) => onPassportCvDataChange((prev) => ({ ...prev, nationalIdNo: value }))}
                />
                <PassportCvInput
                  label="Nationality"
                  value={passportCvData.nationality}
                  onChange={(value) => onPassportCvDataChange((prev) => ({ ...prev, nationality: value }))}
                />
                <CertDatePicker
                  label="Date of Birth"
                  value={passportCvData.dateOfBirth}
                  onChange={(value) => onPassportCvDataChange((prev) => ({ ...prev, dateOfBirth: value }))}
                />
                <PassportCvInput
                  label="Place of Birth"
                  value={passportCvData.placeOfBirth}
                  onChange={(value) => onPassportCvDataChange((prev) => ({ ...prev, placeOfBirth: value }))}
                />
              </div>
            </div>
          )}
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

function PassportCvInput({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="space-y-1.5">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black p-4 text-sm font-bold text-white outline-none transition-all focus:border-orange-500"
        placeholder="Not detected"
      />
    </label>
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
