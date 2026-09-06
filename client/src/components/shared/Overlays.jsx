import { useApp } from '../../context/AppContext'

export function Toast() {
  const { state, dispatch } = useApp()
  if (!state.toast) return null

  // Backwards compatible: a plain string is still a plain toast.
  const isAction = typeof state.toast === 'object'
  const message = isAction ? state.toast.message : state.toast

  const fire = () => {
    state.toast.onAction?.()
    dispatch({ type: 'SET_TOAST', payload: null })
  }

  return (
    <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] animate-toast-in
      ${isAction ? '' : 'pointer-events-none'}`}>
      <div className="bg-td-surface dark:bg-tn-surface border border-td-border dark:border-tn-border
        text-td-fg dark:text-tn-fg text-sm px-4 py-2.5 rounded-xl shadow-e2 whitespace-nowrap
        flex items-center gap-3">
        <span>{message}</span>
        {isAction && (
          <button onClick={fire}
            className="font-semibold text-td-blue dark:text-tn-blue -my-1 py-1 px-1 shrink-0">
            {state.toast.label}
          </button>
        )}
      </div>
    </div>
  )
}

export function ConfirmSheet() {
  const { state, dispatch } = useApp()
  if (!state.confirm) return null

  const dismiss = () => dispatch({ type: 'SET_CONFIRM', payload: null })
  const ok = () => { state.confirm.onOk(); dismiss() }

  return (
    <>
      <div className="fixed inset-0 z-[150] bg-black/50" onClick={dismiss} />
      <div className="fixed bottom-0 left-0 right-0 z-[151] bg-td-bg2 dark:bg-tn-bg2 rounded-t-2xl p-5 pb-10 animate-slide-up">
        <p className="text-td-fg dark:text-tn-fg text-center mb-5 text-sm">{state.confirm.message}</p>
        <div className="flex gap-3">
          <button onClick={dismiss} className="flex-1 py-3 rounded-xl bg-td-surface dark:bg-tn-surface text-td-muted dark:text-tn-muted font-medium text-sm">
            Cancel
          </button>
          <button onClick={ok} className="flex-1 py-3 rounded-xl bg-td-red/20 dark:bg-tn-red/20 text-td-red dark:text-tn-red font-medium text-sm">
            Delete
          </button>
        </div>
      </div>
    </>
  )
}
