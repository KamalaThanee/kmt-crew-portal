import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // 1. ดึงรายชื่อลูกเรือและใบเซอร์ทั้งหมดจาก DB
    const { data: crews } = await supabase.from('crews').select('id, full_name');
    const { data: certs } = await supabase.from('crew_certs').select('id, crew_id, cert_name, file_url');

    if (!crews || !certs) throw new Error("Data not found");

    let updatedCount = 0;
    let logs = [];

    // 2. วนลูปตามรายชื่อลูกเรือเพื่อเข้าไปดูในโฟลเดอร์ Storage
    for (const crew of crews) {
      const folderName = crew.full_name; // หรือล้างชื่อให้ปลอดภัย
      const { data: files, error } = await supabase.storage.from('crew-certificates').list(folderName);

      if (error || !files) continue;

      // 3. จับคู่ไฟล์ใน Storage กับใบเซอร์ใน DB
      const crewCerts = certs.filter(c => c.crew_id === crew.id);
      
      for (const cert of crewCerts) {
        // หาไฟล์ที่ชื่อมีส่วนประกอบของ cert_name
        const matchedFile = files.find(f => 
          f.name.toLowerCase().includes(cert.cert_name.toLowerCase().replace(/[^a-z0-9]/g, "")) ||
          f.name.toLowerCase().includes(cert.cert_name.toLowerCase().substring(0, 10))
        );

        if (matchedFile) {
          const newUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/crew-certificates/${folderName}/${matchedFile.name}`;
          
          // 4. อัปเดตลง Database
          await supabase.from('crew_certs').update({ file_url: newUrl }).eq('id', cert.id);
          updatedCount++;
          logs.push(`Matched: ${cert.cert_name} -> ${matchedFile.name}`);
        }
      }
    }

    return NextResponse.json({ message: `Successfully repaired ${updatedCount} links`, details: logs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
