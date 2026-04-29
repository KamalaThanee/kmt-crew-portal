'use client'

import { AlertTriangle, Users } from 'lucide-react'

type DirectIssuePanelProps = {
  crews: any[]
  enabled: boolean
  targetCrewId: string
  userId?: string
  onEnabledChange: (enabled: boolean) => void
  onTargetCrewChange: (crewId: string) => void
}

export function DirectIssuePanel({
  crews,
  enabled,
  targetCrewId,
  userId,
  onEnabledChange,
  onTargetCrewChange,
}: DirectIssuePanelProps) {
  return (
    <div className={`p-5 rounded-[32px] border transition-all ${enabled ? 'bg-orange-500 border-orange-400' : 'bg-zinc-900 border-white/5 shadow-xl'}`}>
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-2 font-black text-[10px] uppercase tracking-widest ${enabled ? 'text-black' : 'text-orange-500'}`}>
          <Users size={16} />
          Direct Issue Mode
        </div>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onEnabledChange(event.target.checked)}
          className="w-6 h-6 accent-black rounded-lg cursor-pointer"
        />
      </div>
      {enabled && (
        <div className="animate-in slide-in-from-top-2 mt-4 space-y-3">
          <select
            value={targetCrewId}
            onChange={(event) => onTargetCrewChange(event.target.value)}
            className="w-full bg-black/50 border border-white/20 p-4 rounded-xl text-white text-xs font-bold outline-none focus:border-white"
          >
            <option value="">-- Choose Member --</option>
            {crews
              .filter((crew) => crew.id !== userId)
              .map((crew) => (
                <option key={crew.id} value={crew.id}>
                  {crew.full_name}
                </option>
              ))}
          </select>
          <p className="text-[8px] text-black font-black uppercase tracking-tighter flex items-center gap-1">
            <AlertTriangle size={10} />
            This action bypasses user quotas and deducts stock instantly.
          </p>
        </div>
      )}
    </div>
  )
}
