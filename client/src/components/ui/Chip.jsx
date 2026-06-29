/**
 * Token-driven chip for NLP parsed metadata and quick-insert shelf rows.
 * Pass `color` + `bg` as inline style values, or use `variant` for semantic preset.
 */
export function Chip({ label, color, bg, onMouseDown, onTouchStart, onClick, className = '', ...props }) {
  const isInteractive = onMouseDown || onTouchStart || onClick

  const Tag = isInteractive ? 'button' : 'span'

  return (
    <Tag
      className={[
        'inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-lg whitespace-nowrap shrink-0',
        isInteractive && [
          'transition-all duration-fast ease-standard active:scale-[0.97]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-td-blue dark:focus-visible:ring-tn-blue focus-visible:ring-offset-1',
        ].join(' '),
        className,
      ].filter(Boolean).join(' ')}
      style={{ color, background: bg }}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onClick={onClick}
      {...props}
    >
      {label}
    </Tag>
  )
}
