import { supabase } from '@/lib/supabase'

function isMissingRpcError(error: unknown) {
  const message = String((error as { message?: string })?.message || '').toLowerCase()
  return message.includes('could not find the function') || message.includes('schema cache')
}

export async function deductPpeStockFallback(items: Array<{ id?: string | number }>) {
  for (const item of items || []) {
    if (!item?.id) continue

    const { data: inv, error: readError } = await supabase
      .from('ppe_inventory')
      .select('quantity')
      .eq('id', item.id)
      .single()

    if (readError) throw readError
    if (inv) {
      const { error: updateError } = await supabase
        .from('ppe_inventory')
        .update({ quantity: Math.max(0, Number(inv.quantity || 0) - 1) })
        .eq('id', item.id)

      if (updateError) throw updateError
    }
  }
}

export async function deductPpeStock(items: Array<{ id?: string | number }>) {
  const { error } = await supabase.rpc('deduct_ppe_stock', {
    p_items: items || [],
  })

  if (!error) return { usedFallback: false }
  if (!isMissingRpcError(error)) throw error

  await deductPpeStockFallback(items)
  return { usedFallback: true }
}

export async function receivePpeRequest(req: { id: string; items?: Array<{ id?: string | number }> }) {
  const { error } = await supabase.rpc('receive_ppe_request', {
    p_request_id: req.id,
  })

  if (!error) return { usedFallback: false }
  if (!isMissingRpcError(error)) throw error

  await deductPpeStockFallback(req.items || [])
  const { error: updateError } = await supabase
    .from('ppe_requests')
    .update({
      status: 'received',
      received_at: new Date().toISOString(),
    })
    .eq('id', req.id)

  if (updateError) throw updateError
  return { usedFallback: true }
}
