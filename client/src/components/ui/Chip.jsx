/**
 * Token-driven chip for NLP parsed metadata and quick-insert shelf rows.
 * Pass `color` + `bg` as inline style values, or use `variant` for semantic preset.
 *
 * variant="neutral" — muted text, surface bg, hairline border (calm metadata)
 */
export function Chip({ label, icon, color, bg, variant, href, onMouseDown, onTouchStart, onClick, className = '', ...props }) {
  const isInteractive = onMouseDown || onTouchStart || onClick || href

  const Tag = href ? 'a' : (isInteractive ? 'button' : 'span')

  const neutralClasses = 'text-td-muted dark:text-tn-muted bg-td-surface dark:bg-tn-surface border border-td-border/60 dark:border-tn-border/60'

  return (
    <Tag
      href={href}
      target={href ? '_blank' : undefined}
      rel={href ? 'noopener noreferrer' : undefined}
      className={[
        'inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg whitespace-nowrap shrink-0',
        variant === 'neutral' ? neutralClasses : '',
        isInteractive && [
          'transition-all duration-fast ease-standard active:scale-[0.97]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-td-blue dark:focus-visible:ring-tn-blue focus-visible:ring-offset-1',
        ].join(' '),
        className,
      ].filter(Boolean).join(' ')}
      style={!variant ? { color, background: bg } : undefined}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onClick={onClick}
      {...props}
    >
      {icon}
      {label}
    </Tag>
  )
}
