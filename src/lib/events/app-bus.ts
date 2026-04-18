'use client'

/**
 * Audit ref H1: typed app-wide event bus.
 *
 * The codebase had grown ~28 `window.dispatchEvent(new CustomEvent(...))`
 * producers and ~26 matching `window.addEventListener(...)` consumers. Event
 * names and payloads drifted silently because there was no shared type. This
 * module wraps the existing DOM dispatch mechanism in a type-safe surface so:
 *
 *   - TypeScript catches payload mismatches at the producer + consumer
 *   - `rg AppEventName.SETTINGS_TAB_CHANGE` surfaces every producer + consumer
 *   - The migration is incremental: existing `window.addEventListener` calls
 *     keep working because we still dispatch via CustomEvent under the hood.
 *
 * For new features, prefer React context stores (see examples in
 * `lib/stores/`); reach for the bus only when you need to cross a tree
 * boundary (mobile sheet → desktop sidebar, etc.).
 */

import { useEffect, useRef } from 'react'
import type { MeetWithPerson } from '@/lib/hooks/useMeetWith'

export const AppEventName = {
  SETTINGS_TAB_CHANGE: 'settings-tab-change',
  ATHLETICS_TAB_CHANGE: 'athletics-tab-change',
  ATHLETICS_CAMPUS_CHANGE: 'athletics-campus-change',
  ATHLETICS_CALENDAR_TOGGLE: 'athletics-calendar-toggle',
  ATHLETICS_SIDEBAR_REQUEST: 'athletics-sidebar-request',
  CALENDAR_TOGGLE: 'calendar-toggle',
  CALENDAR_CREATE_REQUEST: 'calendar-create-request',
  CALENDAR_UPDATE: 'calendar-update',
  CALENDAR_DELETE: 'calendar-delete',
  MEET_WITH_CHANGE: 'meet-with-change',
  AVATAR_UPDATED: 'avatar-updated',
  PROFILE_UPDATED: 'profile-updated',
  OPEN_BUG_DIALOG: 'open-bug-dialog',
  OPEN_VIEW_AS_DIALOG: 'open-view-as-dialog',
  // Athletics quick-add triggers — no payload, just a signal to open the
  // matching create form on the currently-mounted athletics tab.
  ATHLETICS_ADD_SPORT: 'athletics-add-sport',
  ATHLETICS_ADD_SEASON: 'athletics-add-season',
  ATHLETICS_ADD_TEAM: 'athletics-add-team',
  ATHLETICS_ADD_GAME: 'athletics-add-game',
  ATHLETICS_ADD_PRACTICE: 'athletics-add-practice',
  ATHLETICS_ADD_PLAYER: 'athletics-add-player',
  ATHLETICS_ADD_TOURNAMENT: 'athletics-add-tournament',
} as const

export type AppEventName = (typeof AppEventName)[keyof typeof AppEventName]

/**
 * Payload shape for each event. Add new entries here (and the matching
 * constant above) when introducing a new cross-tree signal.
 */
export interface AppEventPayloads {
  [AppEventName.SETTINGS_TAB_CHANGE]: { tab: string }
  [AppEventName.ATHLETICS_TAB_CHANGE]: { tab: string }
  [AppEventName.ATHLETICS_CAMPUS_CHANGE]: { campusId: string | null }
  [AppEventName.ATHLETICS_CALENDAR_TOGGLE]: { campusId: string; visible: boolean }
  [AppEventName.ATHLETICS_SIDEBAR_REQUEST]: void
  [AppEventName.CALENDAR_TOGGLE]: { calendarId: string }
  [AppEventName.CALENDAR_CREATE_REQUEST]: void
  [AppEventName.CALENDAR_UPDATE]: {
    calendarId: string
    data: { name?: string; color?: string }
  }
  [AppEventName.CALENDAR_DELETE]: { calendarId: string }
  [AppEventName.MEET_WITH_CHANGE]: { people: MeetWithPerson[] }
  [AppEventName.AVATAR_UPDATED]: { avatar: string | null }
  [AppEventName.PROFILE_UPDATED]: { name: string }
  [AppEventName.OPEN_BUG_DIALOG]: void
  [AppEventName.OPEN_VIEW_AS_DIALOG]: void
  [AppEventName.ATHLETICS_ADD_SPORT]: void
  [AppEventName.ATHLETICS_ADD_SEASON]: void
  [AppEventName.ATHLETICS_ADD_TEAM]: void
  [AppEventName.ATHLETICS_ADD_GAME]: void
  [AppEventName.ATHLETICS_ADD_PRACTICE]: void
  [AppEventName.ATHLETICS_ADD_PLAYER]: void
  [AppEventName.ATHLETICS_ADD_TOURNAMENT]: void
}

/**
 * Dispatch a typed app event.
 *
 * @example
 *   emitAppEvent(AppEventName.SETTINGS_TAB_CHANGE, { tab: 'billing' })
 */
export function emitAppEvent<K extends AppEventName>(
  name: K,
  ...args: AppEventPayloads[K] extends void ? [] : [AppEventPayloads[K]]
): void {
  if (typeof window === 'undefined') return
  const detail = args[0]
  window.dispatchEvent(new CustomEvent(name, detail !== undefined ? { detail } : undefined))
}

/**
 * Subscribe to a typed app event for the lifetime of the component.
 *
 * @example
 *   useAppEvent(AppEventName.SETTINGS_TAB_CHANGE, ({ tab }) => setActiveTab(tab))
 */
export function useAppEvent<K extends AppEventName>(
  name: K,
  handler: (
    payload: AppEventPayloads[K] extends void ? undefined : AppEventPayloads[K],
  ) => void,
): void {
  // Use a ref so consumers don't need to memoize their handler
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    function domHandler(event: Event) {
      const custom = event as CustomEvent<AppEventPayloads[K]>
      handlerRef.current(
        custom.detail as AppEventPayloads[K] extends void ? undefined : AppEventPayloads[K],
      )
    }
    window.addEventListener(name, domHandler)
    return () => window.removeEventListener(name, domHandler)
  }, [name])
}
