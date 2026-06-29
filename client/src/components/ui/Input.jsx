import { forwardRef } from 'react'

export const Input = forwardRef(function Input(
  { className = '', ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={[
        'w-full bg-transparent',
        'text-td-fg dark:text-tn-fg',
        'placeholder-td-muted/40 dark:placeholder-tn-muted/40',
        'outline-none',
        'focus-visible:outline-none',
        className,
      ].join(' ')}
      {...props}
    />
  )
})
