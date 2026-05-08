import type { ReactNode } from 'react'
import { Archive, X } from 'lucide-react'

type RestockView = 'entry' | 'history' | 'issue-log'

type ReceiveShipmentModalProps = {
  children: ReactNode
  restockView: RestockView
  onClose: () => void
  onViewChange: (view: RestockView) => void
}

export function ReceiveShipmentModal({
  children,
  restockView,
  onClose,
  onViewChange,
}: ReceiveShipmentModalProps) {
  const getTabClassName = (view: RestockView) => {
    const activeColor = view === 'issue-log' ? 'bg-blue-600 shadow-blue-500/20' : 'bg-emerald-600 shadow-emerald-500/20'
    return `px-8 py-3 rounded-2xl text-xs font-black uppercase transition-all ${
      restockView === view ? `${activeColor} text-white shadow-lg` : 'text-zinc-600'
    }`
  }

  return (
    <div className="fixed inset-0 z-[2000] bg-black/98 flex items-center justify-center p-4 md:p-6 backdrop-blur-3xl animate-in zoom-in duration-300">
      <div className="bg-zinc-900 border border-emerald-500/30 rounded-[56px] w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center border-b border-white/5 p-10 shrink-0">
          <div>
            <h2 className="text-4xl font-black italic uppercase tracking-tighter text-emerald-500 flex items-center gap-4">
              <Archive size={36} /> Receive Shipment
            </h2>
            <div className="flex flex-wrap gap-2 mt-6 bg-black/60 p-1.5 rounded-[20px] w-fit">
              <button onClick={() => onViewChange('entry')} className={getTabClassName('entry')}>New Entry</button>
              <button onClick={() => onViewChange('history')} className={getTabClassName('history')}>Restock History</button>
              <button onClick={() => onViewChange('issue-log')} className={getTabClassName('issue-log')}>Stock Movement</button>
            </div>
          </div>
          <button onClick={onClose} className="p-4 bg-white/5 rounded-full hover:bg-red-500 text-white transition-all self-start shadow-xl">
            <X size={32} />
          </button>
        </div>
        <div className="overflow-y-auto p-10 flex-1 no-scrollbar pb-20">
          {children}
        </div>
      </div>
    </div>
  )
}
