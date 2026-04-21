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
  const [errorLog, setErrorLog] = useState<string[]>([]) // 🎯 เก็บ Log ไว้โชว์หน้าเว็บถ้าพังหมด

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    const reader = new FileReader()
    reader.onloadend = () => setPreview(reader.result as string)
    reader.readAsDataURL(selected)
    setFile(selected)

    setIsScanning(true)
    setScanResult(null)
    setErrorLog([])

    try {
      const user = JSON.parse(localStorage.getItem('kmt_user') || '{}')
      // บีบอัดให้เล็กมากๆ เพื่อให้ส่งผ่านชัวร์ๆ
      const compressedFile = await imageCompression(selected, { maxSizeMB: 0.2, maxWidthOrHeight: 1024, useWebWorker: true });
      const base64 = await imageCompression.getDataUrlFromFile(compressedFile);
      
      let ocrSuccess = false;
      let tempLogs: string[] = [];

      for (let i = 0; i < AI_MODELS.length; i++) {
        const model = AI_MODELS[i];
        setActiveModelLabel(`Trying ${i + 1}/${AI_MODELS.length}: ${model.label}`);
        
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
          });

          const result = await res.json();
          if (!res.ok || result.error) throw new Error(result.error || `HTTP ${res.status}`);

          setScanResult(result);
          setFinalData({ issueDate: result.issueDate || '', expiryDate: result.expiryDate || '' });
          setActiveModelLabel(`Analyzed by: ${model.label}`);
          if (!result.personNameMatch) toast.warning("Name mismatch detected! Please check carefully.");
          
          ocrSuccess = true;
          break;

        } catch (err: any) {
          tempLogs.push(`${model.label} failed: ${err.message}`);
          console.warn(`[${model.label}] failed:`, err.message);
        }
      }

      if (!ocrSuccess) {
        setErrorLog(tempLogs);
        throw new Error("All AI models failed to respond.");
      }

    } catch (err: any) {
      toast.error("AI Analysis Failed");
      setActiveModelLabel("AI Unavailable - Manual Entry Required");
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

      await supabase.from('crew_certs').upsert({
        crew_id: user.id, cert_name: certName, issue_date: finalData.issueDate, expiry_date: finalData.expiryDate, file_url: publicUrl
      });

      toast.success("Certificate saved successfully!");
      router.push('/certificates');
    } catch (err) {
      toast.error("Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-xl mx-auto pb-32 pt-20 font-sans">
      <div className="flex justify-between items-center mb-8">
        <div><h1 className="text-2xl font-black uppercase italic tracking-tighter">Upload Cert</h1><p className="text-blue-500 font-black text-[10px] uppercase mt-1 tracking-widest">{certName}</p></div>
        <button onClick={() => router.push('/certificates')} className="p-3 bg-white/5 rounded-2xl hover:bg-white/10"><X/></button>
      </div>

      <div className="space-y-6">
        <label className="flex flex-col items-center justify-center w-full h-72 border-2 border-dashed border-white/10 rounded-[40px] cursor-pointer hover:bg-white/5 transition-all relative overflow-hidden bg-slate-900 group">
          {preview ? <img src={preview} className="absolute inset-0 w-full h-full object-contain p-6" alt="Preview" /> : <div className="flex flex-col items-center justify-center"><div className="p-5 bg-blue-600/10 rounded-full mb-4 group-hover:scale-110 transition-transform"><Upload className="text-blue-500" size={32} /></div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Tap to Scan Certificate</p></div>}
          <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileChange} />
        </label>

        {isScanning && (
          <div className="flex flex-col items-center justify-center gap-3 p-8 bg-blue-600/5 border border-blue-500/10 rounded-[32px] animate-pulse">
            <Loader2 className="animate-spin text-blue-500" size={32} />
            <p className="text-xs font-black text-blue-400 uppercase tracking-widest text-center">{activeModelLabel}</p>
            <p className="text-[9px] text-slate-600 font-bold uppercase tracking-tighter">Bypassing quotas...</p>
          </div>
        )}

        {/* 🎯 ถ้า AI พังหมดทุกตัว จะโชว์ Log ให้แอดมินดูว่าพังเพราะอะไร */}
        {errorLog.length > 0 && !isScanning && (
          <div className="p-4 bg-red-950/50 border border-red-500/30 rounded-2xl space-y-2">
            <p className="text-[10px] font-black text-red-500 uppercase flex items-center gap-2"><AlertTriangle size={14}/> AI Diagnostics Log</p>
            <ul className="text-[8px] text-red-300 font-mono space-y-1">
              {errorLog.map((log, i) => <li key={i}>{log}</li>)}
            </ul>
          </div>
        )}

        {file && !isScanning && activeModelLabel && !errorLog.length && (
          <div className="text-center">
             <span className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[9px] text-emerald-400 font-black uppercase tracking-widest inline-flex items-center gap-2"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />{activeModelLabel}</span>
          </div>
        )}

        {file && !isScanning && (
          <div className="bg-slate-900 border border-white/10 rounded-[40px] p-8 space-y-6 animate-in slide-in-from-bottom-4 shadow-2xl">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Issue Date</label><input type="date" className="w-full bg-black border border-white/10 p-4 rounded-2xl outline-none focus:border-blue-500 text-white font-bold" value={finalData.issueDate} onChange={e => setFinalData({...finalData, issueDate: e.target.value})} /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Expiry Date</label><input type="date" className="w-full bg-black border border-white/10 p-4 rounded-2xl outline-none focus:border-blue-500 text-white font-bold" value={finalData.expiryDate} onChange={e => setFinalData({...finalData, expiryDate: e.target.value})} /></div>
            </div>
            
            {scanResult && (
               <div className={`p-5 rounded-3xl flex items-start gap-4 border ${scanResult.personNameMatch ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                  {scanResult.personNameMatch ? <CheckCircle className="text-emerald-500 shrink-0"/> : <AlertTriangle className="text-red-500 shrink-0"/>}
                  <div className="space-y-1"><p className="text-[10px] font-black uppercase text-white">{scanResult.personNameMatch ? "Identity Confirmed" : "Name Mismatch Alert"}</p><p className="text-[10px] text-slate-400 font-bold leading-relaxed">{scanResult.note}</p></div>
               </div>
            )}

            <button onClick={handleSave} disabled={isSaving} className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-3xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-blue-600/20 active:scale-95 transition-all">
              {isSaving ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />} Confirm & Save Certificate
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
