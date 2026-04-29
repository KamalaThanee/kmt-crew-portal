'use client'

import type { ChangeEvent } from 'react'
import { FileText, Upload } from 'lucide-react'

type CertificateUploadDropzoneProps = {
  file: File | null
  preview: string | null
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
}

export function CertificateUploadDropzone({ file, preview, onFileChange }: CertificateUploadDropzoneProps) {
  return (
    <label className="flex flex-col items-center justify-center w-full h-72 border-2 border-dashed border-white/10 rounded-[40px] cursor-pointer hover:bg-white/5 transition-all relative overflow-hidden bg-slate-900">
      {preview ? (
        <img src={preview} className="absolute inset-0 w-full h-full object-contain p-6" alt="Certificate preview" />
      ) : file ? (
        <div className="text-center p-6">
          <FileText size={48} className="mx-auto text-emerald-500 mb-2" />
          <p className="text-emerald-500 font-bold text-xs truncate max-w-xs">{file.name}</p>
        </div>
      ) : (
        <div className="text-center">
          <Upload className="mx-auto text-blue-500 mb-4" size={32} />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tap to Scan Certificate</p>
        </div>
      )}
      <input type="file" className="hidden" accept="image/*,application/pdf" onChange={onFileChange} />
    </label>
  )
}
