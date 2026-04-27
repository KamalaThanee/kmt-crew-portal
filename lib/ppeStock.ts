import { supabase } from '@/lib/supabase'

type PpeStockItem = {
  id?: string | number
  item_name?: string
  color?: string
  size?: string
}

type StockMovementContext = {
  requestId?: string | null
  actorName?: string | null
  crewName?: string | null
  movementType?: string
  note?: string | null
}

function isMissingRpcError(error: unknown) {
  const message = String((error as { message?: string })?.message || '').toLowerCase()
  return message.includes('could not find the function') || message.includes('schema cache')
}

async function recordPpeStockTransactions(items: PpeStockItem[], context: StockMovementContext = {}) {
  const rows = (items || [])
    .filter((item) => item?.id)
    .map((item) => ({
      inventory_id: String(item.id),
      request_id: context.requestId || null,
      item_name: item.item_name || null,
      color: item.color || null,
      size: item.size || null,
      quantity_delta: -1,
      movement_type: context.movementType || 'issue',
      actor_name: context.actorName || null,
      crew_name: context.crewName || null,
      note: context.note || null,
    }))

  if (!rows.length) return

  const { error } = await supabase.from('ppe_stock_transactions').insert(rows)
  if (error) {
    const message = String(error.message || '').toLowerCase()
    if (!message.includes('ppe_stock_transactions') && !message.includes('schema cache')) {
      console.warn('Unable to record PPE stock transactions:', error.message)
    }
  }
}

export async function deductPpeStockFallback(items: PpeStockItem[], context: StockMovementContext = {}) {
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

  await recordPpeStockTransactions(items, context)
}

export async function deductPpeStock(items: PpeStockItem[], context: StockMovementContext = {}) {
  const { error } = await supabase.rpc('deduct_ppe_stock', {
    p_items: items || [],
    p_request_id: context.requestId || null,
    p_actor_name: context.actorName || null,
    p_crew_name: context.crewName || null,
    p_movement_type: context.movementType || 'issue',
    p_note: context.note || null,
  })

  if (!error) return { usedFallback: false }
  if (!isMissingRpcError(error)) throw error

  await deductPpeStockFallback(items, context)
  return { usedFallback: true }
}

export async function receivePpeRequest(req: {
  id: string
  items?: PpeStockItem[]
  crew_name?: string | null
  requester_name?: string | null
  full_name?: string | null
}) {
  const user = JSON.parse(localStorage.getItem('kmt_user') || '{}')
  const crewName = req.crew_name || req.requester_name || req.full_name || user.full_name || null
  const { error } = await supabase.rpc('receive_ppe_request', {
    p_request_id: req.id,
    p_actor_name: user.full_name || crewName,
    p_crew_name: crewName,
  })

  if (!error) return { usedFallback: false }
  if (!isMissingRpcError(error)) throw error

  await deductPpeStockFallback(req.items || [], {
    requestId: req.id,
    actorName: user.full_name || crewName,
    crewName,
    movementType: 'receive',
    note: 'Crew confirmed received',
  })
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
