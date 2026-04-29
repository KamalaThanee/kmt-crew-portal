'use client'

import { ChevronRight, User } from 'lucide-react'
import { isCrewActive } from '@/lib/settings'

type CrewCardProps = {
  crew: any
  onClick: (crew: any) => void
}

export function CrewCard({ crew, onClick }: CrewCardProps) {
  const active = isCrewActive(crew)

  return (
    <div
      className={`flex justify-between items-center bg-black/40 p-6 rounded-[32px] border group hover:border-orange-500/50 transition-all cursor-pointer shadow-xl ${
        active ? 'border-white/5' : 'border-red-500/20 opacity-70'
      }`}
      onClick={() => onClick(crew)}
    >
      <div className="flex items-center gap-5">
        <div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-600 group-hover:text-orange-500 transition-colors border border-white/5">
          <User size={28} />
        </div>
        <div>
          <p className="font-bold text-lg text-white group-hover:text-orange-500 transition-colors leading-tight">{crew.full_name}</p>
          <p className="text-xs text-zinc-500 mt-1 uppercase tracking-widest italic">{crew.position}</p>
          {!active && (
            <p className="text-[9px] text-red-400 mt-2 uppercase tracking-widest">
              Resigned {crew.resigned_at ? new Date(crew.resigned_at).toLocaleDateString() : ''}
            </p>
          )}
        </div>
      </div>
      <ChevronRight size={24} className="text-zinc-800 group-hover:text-orange-500 transition-all" />
    </div>
  )
}
