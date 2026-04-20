'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { jsPDF } from 'jspdf'
import imageCompression from 'browser-image-compression'
import { Upload, Loader2, CheckCircle, AlertTriangle, X } from 'lucide-react'

// 🎯 รายชื่อโมเดลตามลำดับที่คุณกำหนดเป๊ะๆ
const AI_MODELS = [
  { id: "nvidia/nemotron-nano-12b-v2-vl:free", provider: "openrouter", label: "Nvidia Nemotron (OpenRouter Free)" },
  { id: "gemini-2.5-flash", provider: "google", label: "Gemini 2.5 Flash (AI Studio)" },
  { id: "google/gemma-4-31b-it:free", provider: "openrouter", label: "Gemma 4 31B (OpenRouter Free Backup)" },
  { id: "gemini-2.5-flash-lite", provider: "google", label: "Gemini 2.5 Flash Lite (AI Studio)" },
  { id: "google/gemini-2.5-flash-lite", provider: "openrouter", label: "Gemini 2.5 Flash Lite (OpenRouter Paid Fallback)" }
];

function UploadContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const certName = searchParams.get('cert') || ''
  
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [scanResult, setScanResult] = useState<any>(null)
  const [activeModelLabel, setActiveModelLabel] = useState<string>("") // 🎯 State บอกสถานะโมเดล
  
  const [finalData, setFinalData] = useState({ issueDate: '', expiryDate: '' })

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    const reader = new FileReader()
    reader.onloadend = () => setPreview(reader.result as string)
    reader.readAsDataURL(selected)
    setFile(selected)

    setIsScanning(true)
    setScanResult(null)
    
    try {
      const user = JSON.parse(localStorage.getItem('kmt_user') || '{}')
      const base64 = await imageCompression.getDataUrlFromFile(selected)
      
      let success = false;

      // 🎯 วนลูปยิง API ทีละตัว ถ้าตัวไหนร่วง ให้ข้ามไปตัวถัดไปอัตโนมัติ
      for (const model of AI_MODELS) {
        setActiveModelLabel(`กำลังใช้: ${model.label}`);
        
        try {
          const res = await fetch('/api/ocr', {
            method: 'POST',
            body: JSON.stringify({ 
              imageBase64: base64, 
              certName, 
              crewName: user.full_name,
              modelId: model.id,
              provider: model.provider
            })
          })
          
          if (!res.ok) throw new Error('API Error');
          const result = await res.json()
          if (result.error) throw new Error(result.error);

          // ถ้าสำเร็จ!
          setScanResult(result)
          setFinalData({ issueDate: result.issueDate || '', expiryDate: result.expiryDate || '' })
          setActiveModelLabel(`วิเคราะห์สำเร็จโดย: ${model.label}`);
          if (!result.personNameMatch) toast.error("ชื่อในใบเซอร์อาจไม่ตรงกับชื่อคุณ กรุณาตรวจสอบ")
          
          success = true;
          break; // 🎯 ทะลุลูปออกไปเลย ไม่ต้องลองตัวต่อไปแล้ว
          
        } catch (fallbackError) {
          console.warn(`Model [${model.id}] failed. Switching to next...`);
          // ถ้า Error ปล่อยให้ลูปมันเดินหน้าต่อไปที่โมเดลถัดไป
        }
      }

      if (!success) {
        throw new Error("AI ทุกตัวหมดโควต้าหรือไม่สามารถตอบสนองได้");
      }

    } catch (err: any) {
      toast.error(err.message)
      setActiveModelLabel("AI ระบบล่ม - กรุณากรอกข้อมูลด้วยตัวเอง")
    } finally {
      setIsScanning(false)
    }
  }

  const handleSave = async () => {
    if (!file || !finalData.issueDate || !finalData.expiryDate) return toast.error('กรุณากรอกวันที่ให้ครบถ้วน');
    setIsSaving(true)

    try {
      const user = JSON.parse(localStorage.getItem('kmt_user') || '{}')
      
      let fileToUpload: Blob = file
      if (file.type.includes('image')) {
        const pdf = new jsPDF()
        const imgProps = pdf.getImageProperties(preview!)
        const pdfWidth = pdf.internal.pageSize.getWidth()
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width
        pdf.addImage(preview!, 'JPEG', 0, 0, pdfWidth, pdfHeight)
        fileToUpload = pdf.output('blob')
      }

      const cleanCertName = certName.replace(/[^a-zA-Z0-9]/g, '_')
      const cleanUserName = user.full_name.replace(/[^a-zA-Z0-9]/g, '_')
      const fileName = `${cleanCertName}_${cleanUserName}_Exp${finalData.expiryDate}.pdf`
      const filePath = `${user.full_name}/${fileName}`

      const { error: uploadError } = await supabase.storage.from('crew-certificates').upload(filePath, fileToUpload, { upsert: true })
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('crew-certificates').getPublicUrl(filePath)

      const { error: dbError } = await supabase.from('crew_certs').upsert({
        crew_id: user.id, cert_name: certName, issue_date: finalData.issueDate, expiry_date: finalData.expiryDate, file_url: publicUrl
      })

      if (dbError) throw dbError

      toast.success("อัปโหลดและบันทึกข้อมูลสำเร็จ!")
      router.push('/certificates')
    } catch (err) {
      toast.error("บันทึกไม่สำเร็จ กรุณาลองใหม่")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-xl mx-auto pb-32 pt-20 font-sans">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-black uppercase italic tracking-tighter">Upload Cert</h1>
          <p className="text-blue-500 font-bold text-xs mt-1 uppercase">{certName}</p>
        </div>
        <button onClick={() => router.push('/certificates')} className="p-2 bg-white/5 rounded-full hover:bg-white/10"><X size={20}/></button>
      </div>

      <div className="space-y-6">
        <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-white/10 rounded-[32px] cursor-pointer hover:bg-white/5 transition-all relative overflow-hidden bg-slate-900">
          {preview ? (
            <img src={preview} className="absolute inset-0 w-full h-full object-contain p-4" alt="Preview" />
          ) : (
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Upload className="w-12 h-12 text-slate-500 mb-4" />
              <p className="text-sm text-slate-400 font-bold uppercase tracking-widest text-[10px]">Select Image / PDF</p>
            </div>
          )}
          <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileChange} />
        </label>

        {/* 🎯 แสดงสถานะ AI ตอนกำลังหมุนติ้วๆ */}
        {isScanning && (
          <div className="flex flex-col items-center justify-center gap-3 p-6 bg-blue-900/10 border border-blue-500/20 rounded-3xl animate-pulse">
            <Loader2 className="animate-spin text-blue-500" size={32} />
            <p className="text-xs font-black text-blue-400 uppercase tracking-widest text-center">{activeModelLabel}</p>
            <p className="text-[9px] text-slate-500 font-bold uppercase text-center">Switching automatically if quota is reached</p>
          </div>
        )}

        {/* 🎯 แสดงชื่อโมเดลที่ทำงานรอดชีวิตมาได้ตอนสแกนเสร็จ */}
        {file && !isScanning && activeModelLabel && (
          <div className="text-center">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[9px] text-emerald-400 font-black uppercase tracking-widest">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              {activeModelLabel}
            </span>
          </div>
        )}

        {file && !isScanning && (
          <div className="bg-slate-900 border border-white/10 rounded-[32px] p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Issue Date</label>
                <input type="date" className="w-full bg-black border border-white/10 p-4 rounded-xl outline-none focus:border-blue-500 text-sm font-bold text-white" 
                  value={finalData.issueDate} onChange={e => setFinalData({...finalData, issueDate: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Expiry Date</label>
                <input type="date" className="w-full bg-black border border-white/10 p-4 rounded-xl outline-none focus:border-blue-500 text-sm font-bold text-white" 
                  value={finalData.expiryDate} onChange={e => setFinalData({...finalData, expiryDate: e.target.value})} />
              </div>
            </div>
            
            {scanResult && (
               <div className={`p-4 rounded-2xl flex items-start gap-3 border ${scanResult.personNameMatch ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                  {scanResult.personNameMatch ? <CheckCircle className="text-emerald-500 shrink-0"/> : <AlertTriangle className="text-red-500 shrink-0"/>}
                  <p className="text-[10px] text-slate-300 font-bold leading-relaxed">{scanResult.note || "ตรวจสอบข้อมูลเรียบร้อย"}</p>
               </div>
            )}

            <button onClick={handleSave} disabled={isSaving} className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-3xl font-black uppercase text-xs flex items-center justify-center gap-2 shadow-xl shadow-blue-600/20 active:scale-95 transition-all">
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
              Confirm & Save Data
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function UploadCertPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse">LOADING...</div>}>
      <UploadContent />
    </Suspense>
  )
}
