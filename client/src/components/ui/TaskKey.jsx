import { useState } from 'react'
import { Check } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { formatTaskKey } from '../../utils'

export function TaskKey({ task, copyable = false, className = '' }) {
  const { state, toast } = useApp()
  const [copied, setCopied] = useState(false)
  const prefix = state?.taskKeyPrefix || 'DO'
  const key = formatTaskKey(task, prefix)
  if (!key) return null

  const copy = async (e) => {
    e.stopPropagation()
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(key)
      } else {
        const ta = document.createElement('textarea')
        ta.value = key
        ta.setAttribute('readonly', '')
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      toast?.(`Copied ${key}`)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast?.('Could not copy')
    }
  }

  const baseCls = `inline-flex items-center gap-1 rounded-md bg-td-bg2 dark:bg-tn-bg2 px-1.5 py-0.5 font-mono text-[11px] text-td-muted dark:text-tn-muted whitespace-nowrap ${className}`

  if (!copyable) return <span className={baseCls}>{key}</span>

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${key}`}
      className={`${baseCls} hover:text-td-fg dark:hover:text-tn-fg transition-colors`}
    >
      <span>{key}</span>
      {copied && <Check size={11} className="text-td-green dark:text-tn-green" />}
    </button>
  )
}
