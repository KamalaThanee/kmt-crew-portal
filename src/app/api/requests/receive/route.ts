import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { requestId, itemId, quantity } = await request.json();

  const { data: item } = await supabase
    .from('ppe_inventory')
    .select('stock_qty')
    .eq('id', itemId)
    .single();

  if (!item || item.stock_qty < quantity) {
    return NextResponse.json({ error: 'สต็อกไม่เพียงพอ' }, { status: 400 });
  }

  const { error: updateStockError } = await supabase
    .from('ppe_inventory')
    .update({ stock_qty: item.stock_qty - quantity })
    .eq('id', itemId);

  if (updateStockError) return NextResponse.json({ error: updateStockError.message }, { status: 500 });

  await supabase
    .from('ppe_requests')
    .update({ 
      status: 'Received',
      received_at: new Date().toISOString()
    })
    .eq('id', requestId);

  return NextResponse.json({ success: true });
}
