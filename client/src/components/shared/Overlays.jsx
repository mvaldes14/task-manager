import { useApp } from '../../context/AppContext'

export function Toast() {
  const { state } = useApp()
  if (!state.toast) return null
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] pointer-events-none animate-toast-in">
      <div className="bg-td-surface dark:bg-tn-surface border border-td-border dark:border-tn-border text-td-fg dark:text-tn-fg text-sm px-4 py-2.5 rounded-xl shadow-xl whitespace-nowrap">
        {state.toast}
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
