'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { jsPDF } from 'jspdf'
import { Upload, Loader2, CheckCircle, AlertTriangle, X, FileText } from 'lucide-react'

const AI_MODELS = [
  { id: "nvidia/nemotron-nano-12b-v2-vl:free", provider: "openrouter", label: "Nvidia Nemotron (Free)" },
  { id: "gemini-2.5-flash", provider: "google", label: "Gemini 2.5 Flash (AI Studio)" },
  { id: "google/gemma-4-31b-it:free", provider: "openrouter", label: "Gemma 4 31B (Backup Free)" },
  { id: "gemini-2.5-flash-lite", provider: "google", label: "Gemini 2.5 Flash Lite (AI Studio)" },
  { id: "google/gemini-2.5-flash-lite", provider: "openrouter", label: "Gemini 2.5 Flash Lite (Paid Fallback)" }
];

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1000; 
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.6)); 
      };
    };
  });
};

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
    setFile(selected)
    const isPDF = selected.type === 'application/pdf';
    if (!isPDF) {
      const reader = new FileReader(); reader.onloadend = () => setPreview(reader.result as string); reader.readAsDataURL(selected);
    } else { setPreview(null); }

    setIsScanning(true); setScanResult(null);
    try {
      const user = JSON.parse(localStorage.getItem('kmt_user') || '{}'); const targetCrewId = searchParams.get('crewId');
      let base64 = ""; let mimeType = isPDF ? "application/pdf" : "image/jpeg";
      if (isPDF) {
        base64 = await new Promise((resolve) => {
          const reader = new FileReader(); reader.readAsDataURL(selected); reader.onloadend = () => resolve(reader.result as string);
        });
      } else { base64 = await compressImage(selected); }

      let success = false;
      for (const model of AI_MODELS) {
        setActiveModelLabel(`Trying: ${model.label}`);
        try {
          const res = await fetch('/api/ocr', {
            method: 'POST',
            body: JSON.stringify({ imageBase64: base64, mimeType, certName, crewName: user.full_name, modelId: model.id, provider: model.provider })
          });
          const result = await res.json();
          if (!res.ok || result.error) throw new Error(result.error);
          setScanResult(result);
          setFinalData({ issueDate: result.issueDate || '', expiryDate: result.expiryDate || '' });
          setActiveModelLabel(`Analyzed by: ${model.label}`);
          success = true; break;
        } catch (err) { console.warn(err); }
      }
      if (!success) throw new Error("AI models busy");
    } catch (err: any) {
      toast.error(err.message); setActiveModelLabel("Manual Entry Required");
    } finally { setIsScanning(false); }
  }

  const handleSave = async () => {
    if (!file || !finalData.issueDate || !finalData.expiryDate) return toast.error('Complete all fields');
    setIsSaving(true);
    try {
      const user = JSON.parse(localStorage.getItem('kmt_user') || '{}'); const targetCrewId = searchParams.get('crewId');;
      
      let fileToUpload: Blob = file;
      if (!file.type.includes('pdf') && preview) {
        const pdf = new jsPDF();
        const imgProps = pdf.getImageProperties(preview);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        pdf.addImage(preview, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        fileToUpload = pdf.output('blob');
      }

      const safeUserName = user.full_name.replace(/[^a-zA-Z0-9]/g, '_');
      const safeCertName = certName.replace(/[^a-zA-Z0-9]/g, '_');
      const filePath = `${safeUserName}/${safeCertName}_${Date.now()}.pdf`;

      const { error: storageError } = await supabase.storage.from('crew-certificates').upload(filePath, fileToUpload);
      if (storageError) throw new Error(storageError.message);

      const { data: { publicUrl } } = supabase.storage.from('crew-certificates').getPublicUrl(filePath);

      // 🎯 แก้ไขตรงนี้: เพิ่ม onConflict เพื่อให้บันทึกทับข้อมูลเดิมได้
      const { error: dbError } = await supabase.from('crew_certs').upsert({
        crew_id: targetCrewId || user.id,
        cert_name: certName,
        issue_date: finalData.issueDate,
        expiry_date: finalData.expiryDate,
        file_url: publicUrl
      }, { onConflict: 'crew_id,cert_name' });

      if (dbError) throw new Error(dbError.message);

      toast.success("Saved successfully!");
      router.push('/certificates');
    } catch (err: any) {
      toast.error(err.message);
    } finally { setIsSaving(false); }
  }

  return (
    <div className="p-6 max-w-xl mx-auto pb-32 pt-20 font-sans">
      <div className="flex justify-between items-center mb-8">
        <div><h1 className="text-2xl font-black uppercase italic tracking-tighter">Upload Cert</h1><p className="text-blue-500 font-bold text-[10px] uppercase mt-1">{certName}</p></div>
        <button onClick={() => router.push('/certificates')} className="p-2 bg-white/5 rounded-full"><X size={20}/></button>
      </div>
      <div className="space-y-6">
        <label className="flex flex-col items-center justify-center w-full h-72 border-2 border-dashed border-white/10 rounded-[40px] cursor-pointer hover:bg-white/5 transition-all relative overflow-hidden bg-slate-900">
          {preview ? <img src={preview} className="absolute inset-0 w-full h-full object-contain p-6" /> : file ? <div className="text-center p-6"><FileText size={48} className="mx-auto text-emerald-500 mb-2"/><p className="text-emerald-500 font-bold text-xs truncate max-w-xs">{file.name}</p></div> : <div className="text-center"><Upload className="mx-auto text-blue-500 mb-4" size={32}/><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tap to Scan Certificate</p></div>}
          <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileChange} />
        </label>
        {isScanning && <div className="flex flex-col items-center justify-center gap-3 p-8 bg-blue-600/5 border border-blue-500/10 rounded-[32px] animate-pulse"><Loader2 className="animate-spin text-blue-500"/><p className="text-xs font-black text-blue-400 uppercase tracking-widest text-center">{activeModelLabel}</p></div>}
        {file && !isScanning && (
          <div className="bg-slate-900 border border-white/10 rounded-[40px] p-8 space-y-6 animate-in slide-in-from-bottom-4 shadow-2xl">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Issue Date</label><input type="date" className="w-full bg-black border border-white/10 p-4 rounded-2xl outline-none focus:border-blue-500 text-white font-bold" value={finalData.issueDate} onChange={e => setFinalData({...finalData, issueDate: e.target.value})} /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Expiry Date</label><input type="date" className="w-full bg-black border border-white/10 p-4 rounded-2xl outline-none focus:border-blue-500 text-white font-bold" value={finalData.expiryDate} onChange={e => setFinalData({...finalData, expiryDate: e.target.value})} /></div>
            </div>
            {scanResult && <div className={`p-5 rounded-3xl flex items-start gap-4 border ${scanResult.personNameMatch ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>{scanResult.personNameMatch ? <CheckCircle className="text-emerald-500 shrink-0"/> : <AlertTriangle className="text-red-500 shrink-0"/>}<div className="space-y-1"><p className="text-[10px] font-black uppercase text-white">{scanResult.personNameMatch ? "Identity Confirmed" : "Name Mismatch Alert"}</p><p className="text-[10px] text-slate-400 font-bold leading-relaxed">{scanResult.note}</p></div></div>}
            <button onClick={handleSave} disabled={isSaving} className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-3xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 shadow-xl transition-all">{isSaving ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />} Confirm & Save</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function UploadCertPage() {
  return ( <Suspense fallback={<div>Loading...</div>}><UploadContent /></Suspense> )
}
