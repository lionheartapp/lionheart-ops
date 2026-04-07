import { Calendar, MapPin, Package } from 'lucide-react'

// ─── Leo Item Drawer Content ──────────────────────────────────────────────────

export function LeoItemDrawerContent({
  type,
  item,
  detail,
}: {
  type: string
  item: Record<string, unknown>
  detail: Record<string, unknown> | null
}) {
  if (type === 'events') return <EventDrawerContent item={item} detail={detail} />
  if (type === 'tickets') return <TicketDrawerContent item={item} />
  if (type === 'users') return <UserDrawerContent item={item} />
  if (type === 'inventory') return <InventoryDrawerContent item={item} />
  return <GenericDrawerContent item={item} />
}

export function EventDrawerContent({ item, detail }: { item: Record<string, unknown>; detail: Record<string, unknown> | null }) {
  // Merge Leo's item data with full API detail (if fetched)
  const title = (detail?.title ?? item.title) as string
  const description = (detail?.description ?? item.description) as string | undefined
  const locationText = (detail?.locationText ?? item.location) as string | undefined
  const startTime = detail?.startTime as string | undefined
  const endTime = detail?.endTime as string | undefined
  const calendarName = (detail?.calendar as Record<string, unknown>)?.name as string ?? item.calendar as string ?? ''
  const calendarColor = (detail?.calendar as Record<string, unknown>)?.color as string ?? '#3B82F6'
  const createdBy = detail?.createdBy as Record<string, unknown> | undefined
  const attendees = detail?.attendees as Array<Record<string, unknown>> | undefined
  const host = item.host as string | undefined
  const date = item.date as string | undefined
  const time = item.time as string | undefined
  const hasOrganizer = createdBy != null || host != null

  const formatEventTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    } catch { return '' }
  }

  const formatEventDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    } catch { return '' }
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h3 className="text-xl font-bold text-slate-900">{title}</h3>
        {description && (
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">{description}</p>
        )}
      </div>

      {/* Date & Time */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <Calendar className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-slate-900">
              {startTime ? formatEventDate(startTime) : date || 'Date not set'}
            </p>
            <p className="text-sm text-slate-500">
              {startTime && endTime
                ? `${formatEventTime(startTime)} – ${formatEventTime(endTime)}`
                : time || ''
              }
            </p>
          </div>
        </div>

        {/* Location */}
        {locationText && (
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-slate-900">{locationText}</p>
          </div>
        )}

        {/* Calendar */}
        {calendarName && (
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: calendarColor }} />
            </div>
            <p className="text-sm text-slate-700">{calendarName}</p>
          </div>
        )}
      </div>

      {hasOrganizer && (
        <div className="pt-3 border-t border-slate-100">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Organizer</p>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {createdBy
                ? String(createdBy.firstName || createdBy.name || 'U').charAt(0).toUpperCase()
                : (host || 'U').charAt(0).toUpperCase()
              }
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">
                {createdBy
                  ? String([createdBy.firstName, createdBy.lastName].filter(Boolean).join(' ') || createdBy.name || createdBy.email || '')
                  : (host || '')
                }
              </p>
              {createdBy?.email != null && (
                <p className="text-xs text-slate-500">{String(createdBy.email)}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Attendees */}
      {attendees && attendees.length > 0 && (
        <div className="pt-3 border-t border-slate-100">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
            Attendees ({attendees.length})
          </p>
          <div className="space-y-2">
            {attendees.map((att, i) => {
              const u = att.user as Record<string, unknown>
              const name = String([u.firstName, u.lastName].filter(Boolean).join(' ') || u.name || 'User')
              const status = att.responseStatus as string
              return (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {u.avatar ? (
                      <img src={String(u.avatar)} alt={name} className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-bold text-slate-600">
                        {name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-slate-700 flex-1">{name}</span>
                  {status && status !== 'PENDING' && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      status === 'ACCEPTED' ? 'bg-green-100 text-green-700' :
                      status === 'DECLINED' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {status.charAt(0) + status.slice(1).toLowerCase()}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Equipment / Metadata */}
      {!!(detail?.metadata && typeof detail.metadata === 'object' && (detail.metadata as Record<string, unknown>).equipment_list) && (
        <div className="pt-3 border-t border-slate-100">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Equipment</p>
          <div className="space-y-1.5">
            {(((detail.metadata as Record<string, unknown>).equipment_list) as Array<Record<string, unknown>>).map((eq, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{String(eq.item)}</span>
                <span className="text-slate-400 font-medium">&times;{Number(eq.quantity)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function TicketDrawerContent({ item }: { item: Record<string, unknown> }) {
  const statusColors: Record<string, string> = {
    OPEN: 'bg-red-100 text-red-700',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    RESOLVED: 'bg-green-100 text-green-700',
  }
  const priorityColors: Record<string, string> = {
    CRITICAL: 'bg-red-100 text-red-700',
    HIGH: 'bg-orange-100 text-orange-700',
    NORMAL: 'bg-yellow-100 text-yellow-700',
    LOW: 'bg-green-100 text-green-700',
  }

  return (
    <div className="space-y-5">
      <h3 className="text-xl font-bold text-slate-900">{String(item.title)}</h3>
      <div className="flex flex-wrap gap-2">
        {!!item.status && (
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[String(item.status)] || 'bg-slate-100 text-slate-600'}`}>
            {String(item.status).replace(/_/g, ' ')}
          </span>
        )}
        {!!item.priority && (
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${priorityColors[String(item.priority)] || 'bg-slate-100 text-slate-600'}`}>
            {String(item.priority)}
          </span>
        )}
      </div>
      <div className="space-y-3 text-sm">
        {!!item.category && (
          <div><span className="font-medium text-slate-700">Category:</span> <span className="text-slate-600">{String(item.category)}</span></div>
        )}
        {!!item.location && (
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-400" />
            <span className="text-slate-600">{String(item.location)}</span>
          </div>
        )}
        {!!item.assignee && (
          <div><span className="font-medium text-slate-700">Assigned to:</span> <span className="text-slate-600">{String(item.assignee)}</span></div>
        )}
        {!!item.created && (
          <div><span className="font-medium text-slate-700">Created:</span> <span className="text-slate-600">{String(item.created)}</span></div>
        )}
        {!!item.id && (
          <div><span className="font-medium text-slate-700">ID:</span> <span className="text-slate-400">{String(item.id)}</span></div>
        )}
      </div>
    </div>
  )
}

export function UserDrawerContent({ item }: { item: Record<string, unknown> }) {
  const nameStr = String(item.name || 'U')
  const initials = nameStr
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-primary-500 flex items-center justify-center text-white text-xl font-bold">
          {initials}
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900">{nameStr}</h3>
          {!!item.email && <p className="text-sm text-slate-500">{String(item.email)}</p>}
        </div>
      </div>
      <div className="space-y-3 text-sm pt-2 border-t border-slate-100">
        {!!item.role && (
          <div><span className="font-medium text-slate-700">Role:</span> <span className="text-slate-600">{String(item.role)}</span></div>
        )}
        {!!item.team && (
          <div><span className="font-medium text-slate-700">Team:</span> <span className="text-slate-600">{String(item.team)}</span></div>
        )}
        {!!item.status && (
          <div>
            <span className="font-medium text-slate-700">Status:</span>{' '}
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${item.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
              {String(item.status)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export function InventoryDrawerContent({ item }: { item: Record<string, unknown> }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200/50 flex items-center justify-center">
          <Package className="w-6 h-6 text-amber-600" />
        </div>
        <h3 className="text-xl font-bold text-slate-900">{String(item.name)}</h3>
      </div>
      <div className="flex gap-3">
        {item.quantity !== undefined && (
          <div className="flex-1 bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
            <p className="text-2xl font-bold text-slate-900">{Number(item.quantity)}</p>
            <p className="text-xs text-slate-500">Total</p>
          </div>
        )}
        {item.available !== undefined && (
          <div className="flex-1 bg-green-50 rounded-xl p-3 text-center border border-green-100">
            <p className="text-2xl font-bold text-green-700">{Number(item.available)}</p>
            <p className="text-xs text-slate-500">Available</p>
          </div>
        )}
      </div>
      <div className="space-y-3 text-sm">
        {!!item.category && (
          <div><span className="font-medium text-slate-700">Category:</span> <span className="text-slate-600">{String(item.category)}</span></div>
        )}
        {!!item.location && (
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-400" />
            <span className="text-slate-600">{String(item.location)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function GenericDrawerContent({ item }: { item: Record<string, unknown> }) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-slate-900">{String(item.title ?? item.name ?? 'Details')}</h3>
      {!!item.subtitle && <p className="text-sm text-slate-600">{String(item.subtitle)}</p>}
      {!!item.detail && <p className="text-sm text-slate-500">{String(item.detail)}</p>}
      {!!item.badge && (
        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
          {String(item.badge)}
        </span>
      )}
    </div>
  )
}
