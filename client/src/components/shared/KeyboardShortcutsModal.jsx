import { useEffect } from 'react'
import { X } from 'lucide-react'

const SHORTCUTS = [
  { section: 'Tasks' },
  { key: 'Q',   desc: 'Add new task' },
  { key: 'Esc', desc: 'Close modal' },
  { section: 'Navigate' },
  { key: 'I',   desc: 'Inbox' },
  { key: 'T',   desc: 'Today' },
  { key: 'O',   desc: 'Overdue' },
  { key: 'C',   desc: 'Calendar' },
  { section: 'View' },
  { key: 'L',   desc: 'List view' },
  { key: 'K',   desc: 'Kanban view' },
  { section: 'UI' },
  { key: 'S',   desc: 'Toggle sidebar' },
  { key: '/',   desc: 'Search tasks' },
  { key: '?',   desc: 'Show this help' },
]

export function KeyboardShortcutsModal({ onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' || e.key === '?') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-sm rounded-2xl
            bg-td-bg2 dark:bg-tn-bg2
            border border-td-border dark:border-tn-border
            shadow-2xl overflow-hidden"
          style={{ animation: 'slideUp 0.18s ease-out' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <h2 className="text-td-fg dark:text-tn-fg font-bold text-base tracking-tight">
                Keyboard Shortcuts
              </h2>
              <p className="text-td-muted dark:text-tn-muted text-xs mt-0.5">
                Press <Kbd>?</Kbd> to toggle
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-td-muted dark:text-tn-muted
                hover:text-td-fg dark:hover:text-tn-fg
                hover:bg-td-surface dark:hover:bg-tn-surface transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          {/* Shortcut list */}
          <div className="px-5 pb-5 space-y-0.5">
            {SHORTCUTS.map((item, i) =>
              item.section ? (
                <div key={i} className="pt-3 pb-1">
                  <span className="text-[10px] font-semibold tracking-widest text-td-muted/50 dark:text-tn-muted/50 uppercase">
                    {item.section}
                  </span>
                </div>
              ) : (
                <div key={i} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-td-muted dark:text-tn-muted">{item.desc}</span>
                  <Kbd>{item.key}</Kbd>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>
    </>
  )
}

function Kbd({ children }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[26px] h-[22px] px-1.5
      rounded-md text-[11px] font-semibold font-mono
      bg-td-surface dark:bg-tn-surface
      text-td-fg dark:text-tn-fg
      border border-td-border dark:border-tn-border
      shadow-[0_1px_0_1px] shadow-td-border/60 dark:shadow-tn-border/60">
      {children}
    </kbd>
  )
}
