import { useRef, useCallback } from 'react'

const HOLD_MS = 500
const MOVE_TOLERANCE = 8   // px; beyond this it's a swipe, not a press

/**
 * Long-press detection that yields to horizontal swipes.
 *
 * TaskCard rows sit inside SwipeableRow, whose useSwipeRow attaches its own
 * non-passive touchmove. Both fire. The contract here is that any movement past
 * MOVE_TOLERANCE cancels the press, so a swipe never also triggers a selection.
 *
 * Returns handlers to spread onto the element. No-ops on non-touch input —
 * desktop uses the hover checkbox instead.
 */
export function useLongPress(onLongPress) {
  const timer = useRef(null)
  const origin = useRef(null)

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    origin.current = null
  }, [])

  const onTouchStart = useCallback((e) => {
    const t = e.touches[0]
    origin.current = { x: t.clientX, y: t.clientY }
    timer.current = setTimeout(() => {
      timer.current = null
      // Haptic nudge where supported; harmless where not.
      if (navigator.vibrate) navigator.vibrate(10)
      onLongPress()
    }, HOLD_MS)
  }, [onLongPress])

  const onTouchMove = useCallback((e) => {
    if (!origin.current) return
    const t = e.touches[0]
    const dx = Math.abs(t.clientX - origin.current.x)
    const dy = Math.abs(t.clientY - origin.current.y)
    if (dx > MOVE_TOLERANCE || dy > MOVE_TOLERANCE) clear()
  }, [clear])

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd: clear,
    onTouchCancel: clear,
  }
}
