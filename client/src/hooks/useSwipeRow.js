import { useRef, useState, useCallback, useEffect } from 'react'

// Module-level: tracks the currently open row's close fn so only one row is open at a time
let closeActiveRow = null

const LOCK_THRESHOLD = 8          // px before we commit to an axis
const AXIS_RATIO = 1.3            // horizontal must be this much greater than vertical to lock
const RIGHT_COMMIT_RATIO = 0.40   // fraction of row width to commit a complete
const RIGHT_COMMIT_VELOCITY = 600 // px/s fast-flick threshold for complete
const TRAY_THRESHOLD = -72        // px left-drag before snapping the tray open
const TRAY_WIDTH = 152            // px width of the snapped-open left tray
const DELETE_COMMIT_RATIO = 0.55  // fraction of row width for a full-left delete commit
const DELETE_COMMIT_VELOCITY = 700
const SNAP_DURATION = 280         // ms for snap-back / commit animation

/**
 * Horizontal swipe gesture hook for task rows (touch-only, non-passive touchmove).
 *
 * Thresholds:
 *   Right swipe commit (complete): dx > 40% width OR velocity > 600 px/s
 *   Left partial  (tray open):     dx < -72 px
 *   Left full commit (delete):     dx < -55% width OR velocity > 700 px/s
 *
 * Returns:
 *   containerRef  — attach to the outermost wrapper div
 *   offset        — current translateX in px (positive=right, negative=left)
 *   phase         — 'idle' | 'dragging' | 'snapping' | 'tray-open'
 *   trayOpen      — true when left tray is snapped open
 *   closeSelf     — programmatically reset/close this row
 *   wasSwipe()    — true if last touch was a committed horizontal drag (suppresses click)
 */
export function useSwipeRow({ onCompleteCommit, onDeleteCommit }) {
  const containerRef = useRef(null)
  const [offset, setOffset] = useState(0)
  const [phase, setPhase] = useState('idle')
  const [trayOpen, setTrayOpen] = useState(false)

  const touchRef    = useRef(null)  // { startX, startY, startTime, locked }
  const didSwipeRef = useRef(false) // true once we lock to horizontal axis

  const prefersReducedMotion = useRef(
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  )

  const closeSelf = useCallback(() => {
    setOffset(0)
    setTrayOpen(false)
    setPhase('idle')
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onStart = (e) => {
      // Ignore touches that land on tray action buttons
      if (e.target.closest('[data-swipe-action]')) return

      const t = e.touches[0]
      touchRef.current = {
        startX: t.clientX,
        startY: t.clientY,
        startTime: Date.now(),
        locked: null, // null=undecided | 'h'=horizontal | 'v'=vertical
      }
      didSwipeRef.current = false
    }

    const onMove = (e) => {
      if (!touchRef.current) return
      const t = e.touches[0]
      const dx = t.clientX - touchRef.current.startX
      const dy = t.clientY - touchRef.current.startY

      // Commit to an axis once movement is unambiguous
      if (touchRef.current.locked === null) {
        if (Math.abs(dx) < LOCK_THRESHOLD && Math.abs(dy) < LOCK_THRESHOLD) return
        touchRef.current.locked = Math.abs(dx) > Math.abs(dy) * AXIS_RATIO ? 'h' : 'v'
      }
      if (touchRef.current.locked !== 'h') return

      e.preventDefault() // take over from native scroll
      didSwipeRef.current = true

      const width = el.offsetWidth

      // Apply rubber-band resistance past the natural ends
      let clamped = dx
      if (dx > 0) {
        const cap = width * 0.45
        clamped = dx > cap ? cap + (dx - cap) * 0.25 : dx
      } else {
        clamped = Math.max(dx, -180)
      }

      setOffset(clamped)
      setPhase('dragging')

      // Register as the active open row (closes any previously open row)
      if (clamped < -10) {
        if (closeActiveRow && closeActiveRow !== closeSelf) closeActiveRow()
        closeActiveRow = closeSelf
      }
    }

    const onEnd = (e) => {
      if (!touchRef.current || touchRef.current.locked !== 'h') {
        touchRef.current = null
        return
      }

      const width = el.offsetWidth
      const elapsed = Math.max(1, Date.now() - touchRef.current.startTime)
      const dx = e.changedTouches[0].clientX - touchRef.current.startX
      const velocity = Math.abs(dx) / elapsed * 1000
      touchRef.current = null

      const snapMs = prefersReducedMotion.current ? 0 : SNAP_DURATION

      if (dx > 0) {
        // ── Right swipe → complete ─────────────────────────────────────
        const committed = dx > width * RIGHT_COMMIT_RATIO || velocity > RIGHT_COMMIT_VELOCITY
        if (committed) {
          setOffset(width)
          setPhase('snapping')
          setTimeout(() => {
            onCompleteCommit()
            setOffset(0)
            setPhase('idle')
            if (closeActiveRow === closeSelf) closeActiveRow = null
          }, snapMs)
        } else {
          setOffset(0)
          setPhase('idle')
        }
      } else {
        // ── Left swipe → tray reveal or delete ────────────────────────
        const deleteCommitted = dx < -width * DELETE_COMMIT_RATIO || velocity > DELETE_COMMIT_VELOCITY

        if (deleteCommitted) {
          setOffset(-width)
          setPhase('snapping')
          setTimeout(() => {
            onDeleteCommit()
            setOffset(0)
            setPhase('idle')
            if (closeActiveRow === closeSelf) closeActiveRow = null
          }, snapMs)
        } else if (dx < TRAY_THRESHOLD) {
          setOffset(-TRAY_WIDTH)
          setTrayOpen(true)
          setPhase('tray-open')
        } else {
          // Under threshold — snap back
          setOffset(0)
          setPhase('idle')
          setTrayOpen(false)
          if (closeActiveRow === closeSelf) closeActiveRow = null
        }
      }
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove',  onMove,  { passive: false })
    el.addEventListener('touchend',   onEnd,   { passive: true })

    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove',  onMove)
      el.removeEventListener('touchend',   onEnd)
      if (closeActiveRow === closeSelf) closeActiveRow = null
    }
  }, [closeSelf, onCompleteCommit, onDeleteCommit])

  const wasSwipe = useCallback(() => didSwipeRef.current, [])

  return { containerRef, offset, phase, trayOpen, closeSelf, wasSwipe }
}
