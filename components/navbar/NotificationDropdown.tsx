import Link from 'next/link'
import { ArrowRight, CheckCircle2, Ruler, XCircle } from 'lucide-react'
import type { AdminActionItem, CrewActionItem, NavbarNotificationData } from '@/hooks/useNavbarNotifications'
import { NotificationLinkItem } from '@/components/navbar/NotificationLinkItem'

type NotificationDropdownProps = {
  isAdmin: boolean
  notifData: NavbarNotificationData
  onClose: () => void
  onOpenPpeSizeModal?: () => void
  onClearRead?: () => void
}

export function NotificationDropdown({ isAdmin, notifData, onClose, onOpenPpeSizeModal, onClearRead }: NotificationDropdownProps) {
  const totalPersonalAdminUpdates = (notifData.personalUpdates || []).length
  const hasNoAlerts =
    notifData.pending + notifData.lowStock + notifData.expiredCerts + (notifData.ppeSizeAlertCount || 0) === 0 &&
    (notifData.updates || []).length === 0 &&
    (notifData.adminActions || []).length === 0 &&
    totalPersonalAdminUpdates === 0

  return (
    <div className="absolute right-0 top-12 w-80 bg-zinc-900 border border-white/10 rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 z-[110]">
      <div className="p-5 bg-black/40 border-b border-white/5">
        <h3 className="text-white font-black italic uppercase text-lg">Notifications</h3>
        <p className="text-orange-500 text-[10px] font-bold tracking-widest mt-1">
          {isAdmin ? 'Action Center' : 'Recent Actions'}
        </p>
      </div>

      <div className="max-h-[min(68vh,560px)] space-y-1 overflow-y-auto bg-black/20 p-2">
        {isAdmin ? (
          <>
            <div className="px-1 pt-2">
              {(notifData.adminActions || []).length > 0 ? (
                <div className="space-y-2">
                  {(notifData.adminActions || []).map((item: AdminActionItem) => {
                    const Icon = item.icon
                    return (
                      <NotificationLinkItem
                        key={item.id}
                        href={item.href}
                        onClick={onClose}
                        title={item.title}
                        titleClassName="normal-case"
                        description={item.description}
                        meta={item.meta}
                        icon={<Icon size={16} />}
                        tone={item.tone}
                      />
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  No recent activity
                </div>
              )}
            </div>

            {totalPersonalAdminUpdates > 0 && (
              <div className="px-1 pt-3">
                <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-widest text-emerald-300">
                  Your PPE Updates
                </p>
                <div className="space-y-2">
                  {(notifData.personalUpdates || []).map((item: CrewActionItem) => {
                    const approved = item.status === 'approved'
                    return (
                      <NotificationLinkItem
                        key={`personal-${item.id}`}
                        href="/my-requests"
                        onClick={onClose}
                        title={item.title}
                        description={item.description}
                        icon={approved ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                        tone={approved ? 'emerald' : 'red'}
                        arrowToneClassName={approved ? 'group-hover:text-emerald-400' : 'group-hover:text-orange-400'}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {(notifData.personalApprovedCount || 0) > 0 && (
              <ReadyToReceiveLink count={notifData.personalApprovedCount} className="mx-1" onClose={onClose} />
            )}

            <PpeSizeAlerts items={notifData.ppeSizeActions || []} className="px-1 pt-3" onClose={onClose} onOpenModal={onOpenPpeSizeModal} />
          </>
        ) : (
          <>
            {(notifData.adminActions || []).length > 0 && (
              <div className="space-y-2 px-1 pt-2">
                {(notifData.adminActions || []).map((item: AdminActionItem) => {
                  const Icon = item.icon
                  return (
                    <NotificationLinkItem
                      key={item.id}
                      href={item.href}
                      onClick={onClose}
                      title={item.title}
                      titleClassName="normal-case"
                      description={item.description}
                      meta={item.meta}
                      icon={<Icon size={16} />}
                      tone={item.tone}
                    />
                  )
                })}
              </div>
            )}
            {(notifData.updates || []).map((item: CrewActionItem) => {
              const approved = item.status === 'approved'
              return (
                <NotificationLinkItem
                  key={item.id}
                  href="/my-requests"
                  onClick={onClose}
                  title={item.title}
                  description={item.description}
                  icon={approved ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  tone={approved ? 'emerald' : 'red'}
                  arrowToneClassName={approved ? 'group-hover:text-emerald-400' : 'group-hover:text-orange-400'}
                />
              )
            })}

            <PpeSizeAlerts items={notifData.ppeSizeActions || []} className="pt-2" onClose={onClose} onOpenModal={onOpenPpeSizeModal} />

            {notifData.approvedCount > 0 && <ReadyToReceiveLink count={notifData.approvedCount} onClose={onClose} />}
          </>
        )}

        {hasNoAlerts && (
          <div className="text-center p-6 text-zinc-600 text-[10px] uppercase font-black tracking-widest">
            No Alerts
          </div>
        )}
      </div>
      {(notifData.adminActions || []).length > 0 && (
        <div className="border-t border-white/5 bg-black/40 p-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void onClearRead?.()}
              className="rounded-xl px-3 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-400 transition-colors hover:bg-white/5 hover:text-orange-400"
            >
              Clear read
            </button>
            <Link
              href="/notifications"
              onClick={onClose}
              className="rounded-xl px-3 py-2 text-center text-[9px] font-black uppercase tracking-widest text-orange-400 transition-colors hover:bg-white/5"
            >
              View all
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function PpeSizeAlerts({
  items,
  className,
  onClose,
  onOpenModal,
}: {
  items: CrewActionItem[]
  className: string
  onClose: () => void
  onOpenModal?: () => void
}) {
  if (items.length === 0) return null

  return (
    <div className={className}>
      <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-widest text-amber-300">
        PPE Size Update
      </p>
      <div className="space-y-2">
        {items.map((item: CrewActionItem) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              onClose()
              if (onOpenModal) onOpenModal()
              else window.dispatchEvent(new Event('open-ppe-size-update'))
            }}
            className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-500/10 bg-amber-500/[0.04] p-4 text-left transition-all hover:bg-white/5"
          >
            <div className="flex min-w-0 items-center gap-4">
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/15 p-2 text-amber-300"><Ruler size={16} /></div>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold uppercase text-white">{item.title}</p>
                <p className="mt-1 line-clamp-2 text-[9px] normal-case text-zinc-400">{item.description}</p>
              </div>
            </div>
            <ArrowRight size={14} className="shrink-0 text-zinc-600 group-hover:text-orange-400" />
          </button>
        ))}
      </div>
    </div>
  )
}

function ReadyToReceiveLink({
  count,
  className = '',
  onClose,
}: {
  count: number
  className?: string
  onClose: () => void
}) {
  return (
    <Link
      href="/my-requests"
      onClick={onClose}
      className={`${className} flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3`}
    >
      <div>
        <p className="text-[10px] font-black uppercase text-emerald-300">Ready to receive</p>
        <p className="text-[9px] text-emerald-100/80 mt-1 normal-case">
          {count} approved legacy item{count > 1 ? 's are' : ' is'} waiting for your confirmation
        </p>
      </div>
      <span className="bg-emerald-400 text-black px-2 py-1 rounded-md text-[9px] font-black">
        ACTION
      </span>
    </Link>
  )
}
