/** Keyboard keycap hint, e.g. <Kbd>⌘K</Kbd> */
export function Kbd({ children, className = '' }) {
  return (
    <kbd
      className={[
        'inline-flex items-center justify-center',
        'min-w-[26px] h-[22px] px-1.5',
        'font-mono font-semibold text-[11px]',
        'text-td-muted dark:text-tn-muted',
        'bg-td-surface dark:bg-tn-surface',
        'border border-td-border dark:border-tn-border',
        'rounded shadow-[inset_0_-1px_0] shadow-td-border/50 dark:shadow-tn-border/80',
        className,
      ].join(' ')}
    >
      {children}
    </kbd>
  )
}
