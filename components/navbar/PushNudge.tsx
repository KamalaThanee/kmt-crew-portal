import { Bell } from 'lucide-react'

type PushNudgeProps = {
  userId?: string
  onEnable: () => void
  onDismiss: () => void
}

export function PushNudge({ userId, onEnable, onDismiss }: PushNudgeProps) {
  return (
    <div className="fixed top-20 left-1/2 z-[120] w-[92%] max-w-md -translate-x-1/2 rounded-2xl border border-emerald-500/20 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-300">
          <Bell size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-widest text-white">Enable push notifications</p>
          <p className="mt-1 text-[10px] leading-relaxed text-zinc-400 normal-case">
            Get alerts when PPE needs action or your PPE status changes.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={onEnable}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-black"
            >
              Enable
            </button>
            <button
              onClick={() => {
                if (userId) {
                  localStorage.setItem(`kmt_push_nudge_dismissed_${userId}`, 'true')
                }
                onDismiss()
              }}
              className="rounded-xl bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-400"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
