import { useEffect, useRef } from 'react'
import { isMutating } from './useTasks'

const THROTTLE_MS = 30_000        // don't refetch more than once per 30s
const POLL_MS     = 5 * 60_000    // background poll every 5 min while visible

// Silently refresh tasks/projects when the app regains focus or becomes
// visible again — reopening the PWA from the app switcher (mobile) or switching
// back to the tab/window (desktop) resumes the existing page without
// remounting, so data would otherwise stay stale until a manual pull-to-refresh.
//
// onRefresh should be loadAll (it keeps tasksLoaded true, so no skeleton flash).
// enabled gates the listeners to the authenticated app (never the login screen).
export function useRefreshOnFocus(onRefresh, enabled) {
  const lastRefresh  = useRef(0)
  const onRefreshRef = useRef(onRefresh)

  useEffect(() => {
    onRefreshRef.current = onRefresh
  }, [onRefresh])

  useEffect(() => {
    if (!enabled) return

    // The mount load already fetched fresh data, so start the throttle window now.
    lastRefresh.current = Date.now()

    const maybeRefresh = () => {
      if (document.visibilityState !== 'visible') return
      if (isMutating()) return                            // don't clobber in-flight edits
      const now = Date.now()
      if (now - lastRefresh.current < THROTTLE_MS) return // throttle rapid switching
      lastRefresh.current = now
      onRefreshRef.current()
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') maybeRefresh()
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', maybeRefresh)
    window.addEventListener('pageshow', maybeRefresh)     // covers bfcache restore
    const interval = setInterval(maybeRefresh, POLL_MS)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', maybeRefresh)
      window.removeEventListener('pageshow', maybeRefresh)
      clearInterval(interval)
    }
  }, [enabled])

  return null
}
