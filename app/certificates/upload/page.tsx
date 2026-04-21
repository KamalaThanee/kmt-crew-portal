'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { jsPDF } from 'jspdf'
import imageCompression from 'browser-image-compression'
import { Upload, Loader2, CheckCircle, AlertTriangle, X } from 'lucide-react'

const AI_MODELS = [
  { id: "nvidia/nemotron-nano-12b-v2-vl:free", provider: "openrouter", label: "Nvidia Nemotron (Free)" },
  { id: "gemini-2.5-flash", provider: "google", label: "Gemini 2.5 Flash (AI Studio)" },
  { id: "google/gemma-4-31b-it:free", provider: "openrouter", label: "Gemma 4 31B (Backup Free)" },
  { id: "gemini-2.5-flash-lite", provider: "google", label: "Gemini 2.5 Flash Lite (AI Studio)" },
  { id: "google/gemini-2.5-flash-lite", provider: "openrouter", label: "Gemini 2.5 Flash Lite (Paid Fallback)" }
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
  const [activeModelLabel, setActiveModelLabel] = useState<string>("") 
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
      // 🎯 บีบอัดรูปหนักขึ้นให้เหลือไฟล์ละ 200KB สูงสุด เพื่อให้ AI อ่านผ่าน 100%
      const compressedFile = await imageCompression(selected, { maxSizeMB: 0.2, maxWidthOrHeight: 1024, useWebWorker: true });
      const base64 = await imageCompression.getDataUrlFromFile(compressedFile);
      
      let ocrSuccess = false;

      for (let i = 0; i < AI_MODELS.length; i++) {
        const model = AI_MODELS[i];
        setActiveModelLabel(`Trying ${i + 1}/${AI_MODELS.length}: ${model.label}`);
        
        try {
          const res = await fetch('/api/ocr', {
            method: 'POST',
            body: JSON.stringify({ imageBase64: base64, certName, crewName: user.full_name, modelId: model.id, provider: model.provider })
          });
          if (!res.ok) throw new Error("API Limit");
          const result = await res.json();
          if (result.error) throw new Error(result.error);

          setScanResult(result);
          setFinalData({ issueDate: result.issueDate || '', expiryDate: result.expiryDate || '' });
          setActiveModelLabel(`Analyzed by: ${model.label}`);
          ocrSuccess = true;
          break; 
        } catch (err) {
          console.warn(`Model ${model.label} failed.`);
        }
      }

      if (!ocrSuccess) throw new Error("All AI models are currently busy.");

    } catch (err: any) {
      toast.error("AI Unavailable - Manual Entry Required");
      setActiveModelLabel("AI Server Busy")
    } finally {
      setIsScanning(false)
    }
  }

  const handleSave = async () => {
    if (!file || !finalData.issueDate || !finalData.expiryDate) return toast.error('Please complete all dates');
    setIsSaving(true);
    try {
      const user = JSON.parse(localStorage.getItem('kmt_user') || '{}')
      let fileToUpload: Blob = file;
      if (file.type.includes('image')) {
        const pdf = new jsPDF();
        const imgProps = pdf.getImageProperties(preview!);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        pdf.addImage(preview!, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        fileToUpload = pdf.output('blob');
      }

      const cleanCert = certName.replace(/[^a-zA-Z0-9]/g, '_');
      const cleanName = user.full_name.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `${cleanCert}_${cleanName}_Exp${finalData.expiryDate}.pdf`;
      const filePath = `${user.full_name}/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('crew-certificates').upload(filePath, fileToUpload, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('crew-certificates').getPublicUrl(filePath);

      await supabase.from('crew_certs').upsert({ crew_id: user.id, cert_name: certName, issue_date: finalData.issueDate, expiry_date: finalData.expiryDate, file_url: publicUrl });

      toast.success("Certificate saved successfully!");
      router.push('/certificates');
    } catch (err) { toast.error("Save failed. Please try again."); } 
    finally { setIsSaving(false); }
  }

  return (
    <div className="p-6 max-w-xl mx-auto pb-32 pt-20 font-sans">
      <div className="flex justify-between items-center mb-8">
        <div><h1 className="text-3xl font-black uppercase italic tracking-tighter">Upload Cert</h1><p className="text-blue-500 font-black text-[10px] uppercase mt-1 tracking-widest">{certName}</p></div>
        <button onClick={() => router.push('/certificates')} className="p-3 bg-white/5 rounded-2xl hover:bg-white/10"><X/></button>
      </div>

      <div className="space-y-6">
        <label className="flex flex-col items-center justify-center w-full h-72 border-2 border-dashed border-white/10 rounded-[40px] cursor-pointer hover:bg-white/5 transition-all relative overflow-hidden bg-slate-900">
          {preview ? <img src={preview} className="absolute inset-0 w-full h-full object-contain p-6" /> : <div className="flex flex-col items-center justify-center"><div className="p-5 bg-blue-600/10 rounded-full mb-4"><Upload className="text-blue-500" size={32} /></div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Tap to Scan Certificate</p></div>}
          <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileChange} />
        </label>

        {isScanning && <div className="flex flex-col items-center justify-center gap-3 p-8 bg-blue-600/5 border border-blue-500/10 rounded-[32px] animate-pulse"><Loader2 className="animate-spin text-blue-500" size={32} /><p className="text-xs font-black text-blue-400 uppercase tracking-widest text-center">{activeModelLabel}</p></div>}

        {file && !isScanning && (
          <div className="bg-slate-900 border border-white/10 rounded-[40px] p-8 space-y-6 animate-in slide-in-from-bottom-4 shadow-2xl">
            {activeModelLabel && <p className="text-center text-[8px] text-emerald-500 font-black uppercase tracking-widest bg-emerald-500/10 px-4 py-2 rounded-full w-fit mx-auto">{activeModelLabel}</p>}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Issue Date</label><input type="date" className="w-full bg-black border border-white/10 p-4 rounded-2xl outline-none focus:border-blue-500 text-white font-bold" value={finalData.issueDate} onChange={e => setFinalData({...finalData, issueDate: e.target.value})} /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Expiry Date</label><input type="date" className="w-full bg-black border border-white/10 p-4 rounded-2xl outline-none focus:border-blue-500 text-white font-bold" value={finalData.expiryDate} onChange={e => setFinalData({...finalData, expiryDate: e.target.value})} /></div>
            </div>
            <button onClick={handleSave} disabled={isSaving} className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-3xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all">{isSaving ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />} Confirm & Save</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function UploadCertPage() {
  return ( <Suspense fallback={<div>Loading...</div>}><UploadContent /></Suspense> )
}
