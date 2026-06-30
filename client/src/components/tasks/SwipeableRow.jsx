import { useSwipeRow } from '../../hooks/useSwipeRow'
import { Check, CalendarClock, Trash2 } from 'lucide-react'

/**
 * Reusable swipe shell that wraps any task row with complete/reschedule/delete
 * gesture support. Extracts the swipe logic from TaskCard so other views
 * (Today, Overdue, …) can share it without duplicating the hook wiring.
 *
 * Props:
 *   onComplete    — called when right-swipe commits; hides green layer when absent
 *   onDelete      — called on full-left commit AND tray Delete tap; hides button when absent
 *   onReschedule  — called when tray Reschedule is tapped; hides button when absent
 *   className     — applied to the outer wrapper (use for border styling)
 *   children      — render-prop: ({ wasSwipe, closeSelf, trayOpen }) => ReactNode
 *                   wasSwipe()  → suppress onClick after a horizontal drag
 *                   closeSelf() → programmatically close/reset the row
 *                   trayOpen    → true when left tray is snapped open
 */
export function SwipeableRow({ onComplete, onDelete, onReschedule, className, children }) {
  const { containerRef, offset, phase, trayOpen, closeSelf, wasSwipe } = useSwipeRow({
    onCompleteCommit: onComplete || (() => {}),
    onDeleteCommit: onDelete || (() => {}),
  })

  const reducedMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false

  const rowStyle = {
    transform: `translateX(${offset}px)`,
    transition:
      phase === 'dragging' || reducedMotion
        ? 'none'
        : 'transform 280ms cubic-bezier(0.32,0.72,0,1)',
    willChange: 'transform',
  }

  const showRight = offset > 2
  const showLeft  = offset < -2

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className || ''}`}
      style={{ touchAction: 'pan-y' }}
    >
      {/* ── Right reveal layer — green (complete) ──────────────────────────── */}
      <div
        aria-hidden="true"
        className={`absolute inset-0 flex items-center gap-2 pl-5
          bg-td-green/15 dark:bg-tn-green/15
          transition-opacity duration-fast
          ${onComplete && showRight ? 'opacity-100' : 'opacity-0'}`}
      >
        <Check size={20} className="text-td-green dark:text-tn-green shrink-0" />
        <span className="text-td-green dark:text-tn-green text-sm font-medium">Complete</span>
      </div>

      {/* ── Left reveal layer — amber (reschedule) + red (delete) ──────────── */}
      <div
        aria-hidden="true"
        className={`absolute inset-0 flex items-center justify-end gap-2 pr-3
          transition-opacity duration-fast
          ${showLeft ? 'opacity-100' : 'opacity-0'}`}
      >
        {onReschedule && (
          <button
            data-swipe-action
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl
              bg-td-amber/15 dark:bg-tn-amber/15
              text-td-amber dark:text-tn-amber
              active:bg-td-amber/25 dark:active:bg-tn-amber/25
              transition-colors duration-fast"
            onClick={e => { e.stopPropagation(); closeSelf(); onReschedule() }}
          >
            <CalendarClock size={16} />
            <span className="text-[10px] font-medium leading-none">Reschedule</span>
          </button>
        )}
        {onDelete && (
          <button
            data-swipe-action
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl
              bg-td-red/15 dark:bg-tn-red/15
              text-td-red dark:text-tn-red
              active:bg-td-red/25 dark:active:bg-tn-red/25
              transition-colors duration-fast"
            onClick={e => { e.stopPropagation(); closeSelf(); onDelete() }}
          >
            <Trash2 size={16} />
            <span className="text-[10px] font-medium leading-none">Delete</span>
          </button>
        )}
      </div>

      {/* ── Sliding row content ─────────────────────────────────────────────── */}
      <div style={rowStyle} className="relative z-10">
        {children({ wasSwipe, closeSelf, trayOpen })}
      </div>
    </div>
  )
}
