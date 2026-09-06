import { useRef, useState, useCallback, useEffect } from 'react'

const LOCK_THRESHOLD = 8      // px before committing to an axis
const AXIS_RATIO = 1.3        // vertical must exceed horizontal by this factor
const COMMIT_RATIO = 0.35     // fraction of sheet height that commits a dismiss
const COMMIT_VELOCITY = 550   // px/s fast-flick threshold
const SNAP_DURATION = 260     // ms for spring-back / dismiss animation
const MOBILE_MAX = 768        // matches Tailwind's md breakpoint

/**
 * Vertical pull-to-dismiss for the mobile task sheet.
 *
 * Ported from useSwipeRow.js: same axis-lock ratio test, same non-passive
 * touchmove, same distance-or-velocity commit, same reduced-motion handling.
 * Downward only — the sheet is pinned at top-20 and has nowhere to go up.
 *
 * Attach `dragRef` to the grabber + header wrapper (the pull target) and
 * `sheetRef` to the sheet element itself (what actually translates).
 *
 * Returns:
 *   dragRef   — attach to the pull target
 *   sheetRef  — attach to the translating sheet
 *   offset    — current translateY in px, always >= 0
 *   phase     — 'idle' | 'dragging' | 'snapping'
 */
export function useSheetDismiss({ onDismiss }) {
  const dragRef = useRef(null)
  const sheetRef = useRef(null)
  const [offset, setOffset] = useState(0)
  const [phase, setPhase] = useState('idle')

  const touchRef = useRef(null) // { startY, startX, startTime, locked }

  const prefersReducedMotion = useRef(
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  )

  const reset = useCallback(() => {
    setOffset(0)
    setPhase('idle')
  }, [])

  useEffect(() => {
    const el = dragRef.current
    if (!el) return

    const isMobile = () => window.innerWidth < MOBILE_MAX

    const onStart = (e) => {
      if (!isMobile()) return
      // Let the close and delete buttons in the header take their own taps
      if (e.target.closest('button')) return
      const t = e.touches[0]
      touchRef.current = {
        startX: t.clientX,
        startY: t.clientY,
        startTime: Date.now(),
        locked: null,
      }
    }

    const onMove = (e) => {
      if (!touchRef.current) return
      const t = e.touches[0]
      const dx = t.clientX - touchRef.current.startX
      const dy = t.clientY - touchRef.current.startY

      if (touchRef.current.locked === null) {
        if (Math.abs(dx) < LOCK_THRESHOLD && Math.abs(dy) < LOCK_THRESHOLD) return
        touchRef.current.locked = Math.abs(dy) > Math.abs(dx) * AXIS_RATIO ? 'v' : 'h'
      }
      if (touchRef.current.locked !== 'v') return

      // Upward drags are inert, but keep the gesture captured so releasing
      // above the start point doesn't leave the sheet mid-animation.
      if (dy <= 0) {
        setOffset(0)
        return
      }

      e.preventDefault()
      setOffset(dy)
      setPhase('dragging')
    }

    const onEnd = (e) => {
      if (!touchRef.current || touchRef.current.locked !== 'v') {
        touchRef.current = null
        return
      }

      const height = sheetRef.current?.offsetHeight || window.innerHeight
      const elapsed = Math.max(1, Date.now() - touchRef.current.startTime)
      const dy = e.changedTouches[0].clientY - touchRef.current.startY
      const velocity = dy / elapsed * 1000
      touchRef.current = null

      const snapMs = prefersReducedMotion.current ? 0 : SNAP_DURATION

      if (dy > height * COMMIT_RATIO || velocity > COMMIT_VELOCITY) {
        setOffset(height)
        setPhase('snapping')
        setTimeout(() => {
          onDismiss()
          reset()
        }, snapMs)
      } else {
        setOffset(0)
        setPhase('snapping')
        setTimeout(reset, snapMs)
      }
    }

    const onCancel = () => {
      touchRef.current = null
      setOffset(0)
      setPhase('idle')
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onCancel, { passive: true })

    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onCancel)
    }
  }, [onDismiss, reset])

  return { dragRef, sheetRef, offset, phase }
}
