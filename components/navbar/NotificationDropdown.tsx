import Link from 'next/link'
import { CheckCircle2, FileBadge, ShipWheel, XCircle } from 'lucide-react'
import type { AdminActionItem, CrewActionItem, NavbarNotificationData } from '@/hooks/useNavbarNotifications'
import { NotificationLinkItem } from '@/components/navbar/NotificationLinkItem'

type NotificationDropdownProps = {
  isAdmin: boolean
  notifData: NavbarNotificationData
  onClose: () => void
}

export function NotificationDropdown({ isAdmin, notifData, onClose }: NotificationDropdownProps) {
  const totalPersonalAdminUpdates = (notifData.personalUpdates || []).length
  const hasNoAlerts =
    notifData.pending + notifData.lowStock + notifData.expiredCerts + (notifData.personalCertAlertCount || 0) + (notifData.shipCertAlertCount || 0) === 0 &&
    (notifData.updates || []).length === 0

  return (
    <div className="absolute right-0 top-12 w-80 bg-zinc-900 border border-white/10 rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 z-[110]">
      <div className="p-5 bg-black/40 border-b border-white/5">
        <h3 className="text-white font-black italic uppercase text-lg">Notifications</h3>
        <p className="text-orange-500 text-[10px] font-bold tracking-widest mt-1">
          {isAdmin ? 'Action Center' : 'Recent Actions'}
        </p>
      </div>

      <div className="p-2 space-y-1 bg-black/20">
        {isAdmin ? (
          <>
            <div className="px-1 pt-2">
              <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-widest text-amber-300">
                PPE Request Feed
              </p>
              {(notifData.pendingActions || []).length > 0 ? (
                <div className="space-y-2">
                  {(notifData.pendingActions || []).map((item: AdminActionItem) => {
                    const Icon = item.icon
                    return (
                      <NotificationLinkItem
                        key={item.id}
                        href={item.href}
                        onClick={onClose}
                        title={item.title}
                        description={item.description}
                        meta={item.meta}
                        badge={item.countLabel || 'NEW'}
                        icon={<Icon size={16} />}
                        tone="amber"
                      />
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  No new PPE requests right now
                </div>
              )}
            </div>

            {totalPersonalAdminUpdates > 0 && (
              <div className="px-1 pt-3">
                <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-widest text-emerald-300">
                  Your Request Updates
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

            <CertificateAlerts items={notifData.personalCertActions || []} className="px-1 pt-3" onClose={onClose} />
            <ShipCertificateAlerts items={notifData.shipCertActions || []} className="px-1 pt-3" onClose={onClose} />
          </>
        ) : (
          <>
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

            <CertificateAlerts items={notifData.personalCertActions || []} className="pt-2" onClose={onClose} />
            <ShipCertificateAlerts items={notifData.shipCertActions || []} className="pt-2" onClose={onClose} />

            {notifData.approvedCount > 0 && <ReadyToReceiveLink count={notifData.approvedCount} onClose={onClose} />}
          </>
        )}

        {hasNoAlerts && (
          <div className="text-center p-6 text-zinc-600 text-[10px] uppercase font-black tracking-widest">
            No Alerts
          </div>
        )}
      </div>
    </div>
  )
}

function ShipCertificateAlerts({
  items,
  className,
  onClose,
}: {
  items: CrewActionItem[]
  className: string
  onClose: () => void
}) {
  if (items.length === 0) return null

  return (
    <div className={className}>
      <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-widest text-orange-300">
        Ship Certificates
      </p>
      <div className="space-y-2">
        {items.map((item: CrewActionItem) => (
          <NotificationLinkItem
            key={item.id}
            href={item.href || '/admin/ship-certificates'}
            onClick={onClose}
            title={item.title}
            description={item.description}
            icon={<ShipWheel size={16} />}
            tone="amber"
          />
        ))}
      </div>
    </div>
  )
}

function CertificateAlerts({
  items,
  className,
  onClose,
}: {
  items: CrewActionItem[]
  className: string
  onClose: () => void
}) {
  if (items.length === 0) return null

  return (
    <div className={className}>
      <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-widest text-sky-300">
        My Certificates
      </p>
      <div className="space-y-2">
        {items.map((item: CrewActionItem) => (
          <NotificationLinkItem
            key={item.id}
            href={item.href || '/certificates?tab=personal'}
            onClick={onClose}
            title={item.title}
            description={item.description}
            icon={<FileBadge size={16} />}
            tone="sky"
          />
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
          {count} approved request{count > 1 ? 's are' : ' is'} waiting for your confirmation
        </p>
      </div>
      <span className="bg-emerald-400 text-black px-2 py-1 rounded-md text-[9px] font-black">
        ACTION
      </span>
    </Link>
  )
}
