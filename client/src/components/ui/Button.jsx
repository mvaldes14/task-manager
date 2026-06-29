import { forwardRef } from 'react'

const VARIANT_CLASSES = {
  primary:   'bg-td-blue dark:bg-tn-blue text-white hover:brightness-110 disabled:opacity-40',
  secondary: 'bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg border border-td-border dark:border-tn-border hover:bg-td-bg2 dark:hover:bg-tn-bg3 disabled:opacity-40',
  ghost:     'text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg disabled:opacity-40',
  danger:    'bg-td-red/15 dark:bg-tn-red/15 text-td-red dark:text-tn-red border border-td-red/30 dark:border-tn-red/30 hover:bg-td-red/25 dark:hover:bg-tn-red/25 disabled:opacity-40',
}

const SIZE_CLASSES = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-5 py-2.5 text-sm rounded-xl gap-2',
}

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, disabled = false, as: Tag = 'button', children, className = '', ...props },
  ref
) {
  return (
    <Tag
      ref={ref}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center font-semibold select-none',
        'transition-all duration-fast ease-standard',
        'active:scale-[0.97]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-td-blue dark:focus-visible:ring-tn-blue focus-visible:ring-offset-1',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      ].join(' ')}
      {...props}
    >
      {loading ? (
        <>
          <span className="inline-block w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" aria-hidden="true" />
          {children}
        </>
      ) : children}
    </Tag>
  )
})
