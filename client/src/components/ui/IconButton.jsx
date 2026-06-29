import { forwardRef } from 'react'

const VARIANT_CLASSES = {
  primary:   'bg-td-blue dark:bg-tn-blue text-white hover:brightness-110 disabled:opacity-40',
  secondary: 'bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg border border-td-border dark:border-tn-border hover:bg-td-bg2 dark:hover:bg-tn-bg3 disabled:opacity-40',
  ghost:     'text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg disabled:opacity-40',
  danger:    'bg-td-red/15 dark:bg-tn-red/15 text-td-red dark:text-tn-red border border-td-red/30 dark:border-tn-red/30 hover:bg-td-red/25 dark:hover:bg-tn-red/25 disabled:opacity-40',
}

const SIZE_CLASSES = {
  sm: 'w-7 h-7 rounded-lg text-sm',
  md: 'w-9 h-9 rounded-xl text-base',
}

export const IconButton = forwardRef(function IconButton(
  { variant = 'ghost', size = 'md', disabled = false, className = '', 'aria-label': ariaLabel, children, ...props },
  ref
) {
  if (!ariaLabel) console.warn('IconButton: aria-label is required for accessibility')

  return (
    <button
      ref={ref}
      disabled={disabled}
      aria-label={ariaLabel}
      className={[
        'inline-flex items-center justify-center shrink-0 select-none',
        'transition-all duration-fast ease-standard',
        'active:scale-[0.97]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-td-blue dark:focus-visible:ring-tn-blue focus-visible:ring-offset-1',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  )
})
