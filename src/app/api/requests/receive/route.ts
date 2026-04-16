import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { requestId, itemId, quantity } = await request.json();

    // 1. ตรวจสอบสต็อก
    const { data: item, error: fetchError } = await supabase
      .from('ppe_inventory')
      .select('stock_qty')
      .eq('id', itemId)
      .single();

    if (fetchError || !item) {
      return NextResponse.json({ error: 'ไม่พบสินค้าในสต็อก' }, { status: 404 });
    }

    if (item.stock_qty < quantity) {
      return NextResponse.json({ error: 'สต็อกไม่เพียงพอ' }, { status: 400 });
    }

    // 2. หักสต็อกจริง
    const { error: updateStockError } = await supabase
      .from('ppe_inventory')
      .update({ stock_qty: item.stock_qty - quantity })
      .eq('id', itemId);

    if (updateStockError) {
      return NextResponse.json({ error: 'หักสต็อกไม่สำเร็จ' }, { status: 500 });
    }

    // 3. เปลี่ยนสถานะคำขอเป็น Received
    const { error: updateRequestError } = await supabase
      .from('ppe_requests')
      .update({ 
        status: 'Received',
        received_at: new Date().toISOString()
      })
      .eq('id', requestId);

    if (updateRequestError) {
      return NextResponse.json({ error: 'อัปเดตสถานะไม่สำเร็จ' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}
