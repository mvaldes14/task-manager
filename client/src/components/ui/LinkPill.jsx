import { Paperclip, GitBranch, Link2 } from 'lucide-react'
import { getLinkLabel, getLinkStyle } from '../../utils'
import { useApp } from '../../context/AppContext'

export function LinkIcon({ url, size = 10 }) {
  if (url?.startsWith('obsidian://')) return <Paperclip size={size} />
  if (url?.includes('github.com')) return <GitBranch size={size} />
  return <Link2 size={size} />
}

export function LinkPill({ url, className = '' }) {
  const { state } = useApp()
  if (!url) return null

  const isDark = state.theme === 'dark'
  const label = getLinkLabel(url)
  const style = getLinkStyle(url, isDark)

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      draggable={false}
      onClick={e => e.stopPropagation()}
      title={url}
      aria-label={`Open ${label}`}
      style={{ color: style.color, background: style.bg }}
      className={[
        'inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-md whitespace-nowrap shrink-0 max-w-[180px] hover:opacity-80 transition-opacity',
        className,
      ].filter(Boolean).join(' ')}
    >
      <LinkIcon url={url} />
      <span className="truncate">{label}</span>
    </a>
  )
}

export function LinkPills({ links, max, className = '' }) {
  const validLinks = (links || []).filter(link => link?.url)
  if (validLinks.length === 0) return null

  const visibleLinks = max ? validLinks.slice(0, max) : validLinks
  const hiddenCount = max ? Math.max(0, validLinks.length - max) : 0

  return (
    <span className="inline-flex items-center gap-1 min-w-0">
      {visibleLinks.map((link, i) => (
        <LinkPill key={`${link.url}-${i}`} url={link.url} className={className} />
      ))}
      {hiddenCount > 0 && (
        <span className="text-[10px] text-td-muted/60 dark:text-tn-muted/60 shrink-0">
          +{hiddenCount}
        </span>
      )}
    </span>
  )
}
