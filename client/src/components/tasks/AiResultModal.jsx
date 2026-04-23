import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Sparkles } from 'lucide-react'
import { api } from '../../api'

export function AiResultModal({ taskId, onClose }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    api.getTaskAi(taskId)
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message || 'Failed to load'); setLoading(false) })
  }, [taskId])

  return createPortal(
    <>
      <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[301] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-2xl bg-td-bg2 dark:bg-tn-bg2 rounded-2xl
            border border-td-border dark:border-tn-border shadow-2xl flex flex-col max-h-[80vh]"
          style={{ animation: 'slideUp 0.18s ease-out' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-td-border/50 dark:border-tn-border/50 shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-td-purple dark:text-tn-purple" />
              <span className="font-semibold text-sm text-td-fg dark:text-tn-fg">AI Result</span>
              {data?.model && (
                <span className="text-[11px] text-td-muted dark:text-tn-muted">· {data.model}</span>
              )}
            </div>
            <button onClick={onClose}
              className="text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 px-5 py-4">
            {loading && (
              <p className="text-sm text-td-muted dark:text-tn-muted">Loading…</p>
            )}
            {error && (
              <p className="text-sm text-td-red dark:text-tn-red">{error}</p>
            )}
            {data?.content && (
              <pre className="text-sm text-td-fg dark:text-tn-fg whitespace-pre-wrap leading-relaxed font-sans">
                {data.content}
              </pre>
            )}
          </div>

          {/* Footer */}
          {data?.updated_at && (
            <div className="px-5 py-3 border-t border-td-border/30 dark:border-tn-border/30 shrink-0">
              <p className="text-[11px] text-td-muted/60 dark:text-tn-muted/60">
                Updated {new Date(data.updated_at).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  )
}
