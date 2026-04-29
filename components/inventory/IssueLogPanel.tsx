import type { StockTransaction } from '@/lib/inventoryTypes'

type IssueLogPanelProps = {
  stockTransactions: StockTransaction[]
  stockTransactionError: string
  isRefreshingTransactions: boolean
  onRefreshTransactions: () => void
}

export function IssueLogPanel({
  stockTransactions,
  stockTransactionError,
  isRefreshingTransactions,
  onRefreshTransactions,
}: IssueLogPanelProps) {
  return (
    <div className="space-y-4 pb-20 max-w-5xl mx-auto animate-in fade-in">
      <div className="rounded-[32px] border border-blue-500/20 bg-blue-500/10 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-blue-300 text-[10px] tracking-[0.25em] uppercase">Stock Movement Audit</p>
            <p className="mt-2 text-sm normal-case text-zinc-300">Latest {stockTransactions.length} stock deductions from received requests and direct issue.</p>
            <p className="mt-1 text-[11px] normal-case text-zinc-500">If this is empty after deploy, rerun sql/ppe_stock_transactions.sql once to backfill old received requests.</p>
          </div>
          <button onClick={onRefreshTransactions} disabled={isRefreshingTransactions} className="rounded-2xl border border-blue-400/30 bg-blue-500/10 px-5 py-3 text-[10px] font-black text-blue-200 transition-all hover:bg-blue-500 hover:text-white disabled:cursor-wait disabled:opacity-60">
            {isRefreshingTransactions ? 'Refreshing...' : 'Refresh Log'}
          </button>
        </div>
        {stockTransactionError && (
          <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-[11px] normal-case text-red-200">
            {stockTransactionError}. Run <span className="font-black text-white">sql/ppe_stock_transactions.sql</span> in Supabase, then press Refresh Log again.
          </div>
        )}
      </div>
      {stockTransactions.length === 0 ? (
        <div className="rounded-[40px] border border-white/5 bg-black/40 p-12 text-center text-zinc-600 font-black tracking-widest">
          No issue transactions yet
        </div>
      ) : stockTransactions.map((movement) => (
        <div key={movement.id} className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-5 rounded-[32px] border border-white/5 bg-black/40 p-6 shadow-xl">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`rounded-full px-3 py-1 text-[8px] font-black tracking-widest ${movement.movement_type === 'direct_issue' ? 'bg-orange-500/20 text-orange-300' : 'bg-blue-500/20 text-blue-300'}`}>
                {String(movement.movement_type || 'issue').replace(/_/g, ' ')}
              </span>
              <span className="text-zinc-600 text-[10px]">{new Date(movement.created_at).toLocaleString()}</span>
            </div>
            <p className="text-white text-base font-black italic uppercase">
              {movement.item_name || 'Unknown Item'}
              <span className="ml-2 text-blue-300 text-xs not-italic">{[movement.color, movement.size].filter(Boolean).join(' | ')}</span>
            </p>
            <p className="text-zinc-400 normal-case text-xs">
              Crew: <span className="text-white font-black">{movement.crew_name || '-'}</span>
              <span className="mx-2 text-zinc-700">|</span>
              By: <span className="text-white font-black">{movement.actor_name || '-'}</span>
            </p>
            {movement.note && <p className="text-[11px] normal-case text-zinc-600">{movement.note}</p>}
          </div>
          <div className="flex items-center justify-end">
            <span className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-3 text-xl font-black text-red-400">
              {movement.quantity_delta}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
