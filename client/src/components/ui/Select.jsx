import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'

const MOBILE_QUERY = '(max-width: 767px)'
const VIEWPORT_MARGIN = 8

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_QUERY).matches : false
  ))

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY)
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return isMobile
}

function isPrintableKey(e) {
  return e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey
}

function firstEnabledIndex(options, start = 0) {
  for (let i = start; i < options.length; i++) {
    if (!options[i].disabled) return i
  }
  for (let i = 0; i < start; i++) {
    if (!options[i].disabled) return i
  }
  return -1
}

function moveEnabled(options, current, delta) {
  if (!options.length) return -1
  let next = current
  for (let i = 0; i < options.length; i++) {
    next = (next + delta + options.length) % options.length
    if (!options[next].disabled) return next
  }
  return current
}

function optionLabel(options, value, placeholder) {
  return options.find(o => o.value === value)?.label || placeholder || ''
}

function OptionContent({ option, selected }) {
  return (
    <>
      {option.dotClass && <span className={`w-2 h-2 rounded-full shrink-0 ${option.dotClass}`} />}
      <span className="truncate flex-1">{option.label}</span>
      {selected && <Check size={14} className="ml-auto shrink-0" />}
    </>
  )
}

function SelectList({ idBase, options, value, activeIndex, setActiveIndex, onPick, className = '', itemClassName = '' }) {
  return (
    <div
      role="listbox"
      tabIndex={-1}
      aria-activedescendant={activeIndex >= 0 ? `${idBase}-${activeIndex}` : undefined}
      className={className}
    >
      {options.map((option, i) => {
        const selected = option.value === value
        const active = i === activeIndex
        return (
          <button
            key={option.value}
            id={`${idBase}-${i}`}
            type="button"
            role="option"
            aria-selected={selected}
            disabled={option.disabled}
            onMouseEnter={() => !option.disabled && setActiveIndex(i)}
            onClick={() => !option.disabled && onPick(option.value)}
            className={[
              itemClassName,
              'w-full flex items-center gap-2 text-left transition-colors duration-fast',
              active ? 'bg-td-border/40 dark:bg-tn-border/40' : '',
              selected ? 'text-td-blue dark:text-tn-blue' : 'text-td-fg dark:text-tn-fg',
              option.depth ? 'pl-7 text-td-muted dark:text-tn-muted' : '',
              option.disabled ? 'opacity-40 pointer-events-none' : '',
            ].filter(Boolean).join(' ')}
          >
            <OptionContent option={option} selected={selected} />
          </button>
        )
      })}
    </div>
  )
}

function DesktopMenu({ triggerRef, menuRef, idBase, variant, options, value, activeIndex, setActiveIndex, onPick, onClose }) {
  useLayoutEffect(() => {
    const trigger = triggerRef.current
    const menu = menuRef.current
    if (!trigger || !menu) return

    const rect = trigger.getBoundingClientRect()
    const menuHeight = menu.offsetHeight || 0
    const spaceBelow = window.innerHeight - rect.bottom - 6 - VIEWPORT_MARGIN
    const spaceAbove = rect.top - 6 - VIEWPORT_MARGIN
    const flip = spaceBelow < menuHeight && spaceAbove > spaceBelow

    const width = variant === 'overlay'
      ? Math.min(rect.width, 280)
      : Math.max(rect.width, 180)

    let left = variant === 'overlay' ? rect.right - width : rect.left
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - width - VIEWPORT_MARGIN))

    let top = flip ? rect.top - menuHeight - 6 : rect.bottom + 6
    top = Math.max(VIEWPORT_MARGIN, Math.min(top, window.innerHeight - menuHeight - VIEWPORT_MARGIN))

    menu.style.left = `${left}px`
    menu.style.top = `${top}px`
    menu.style.width = `${width}px`
    menu.style.opacity = '1'
  }, [triggerRef, menuRef, variant, options.length])

  useEffect(() => {
    const onResize = () => onClose(false)
    const onScroll = (e) => {
      if (menuRef.current?.contains(e.target)) return
      onClose(false)
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [menuRef, onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[250]"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      <button type="button" aria-label="Close menu" className="fixed inset-0 cursor-default" onClick={() => onClose(true)} />
      <div
        ref={menuRef}
        style={{ left: -9999, top: -9999, width: variant === 'overlay' ? 280 : 180, opacity: 0 }}
        className="fixed z-[251] bg-td-surface dark:bg-tn-surface border border-td-border dark:border-tn-border rounded-xl shadow-e2 motion-safe:animate-fade-in p-1 max-h-80 overflow-y-auto overscroll-contain select-none"
      >
        <SelectList
          idBase={idBase}
          options={options}
          value={value}
          activeIndex={activeIndex}
          setActiveIndex={setActiveIndex}
          onPick={onPick}
          className="outline-none"
          itemClassName="px-3 min-h-[36px] rounded-lg text-sm cursor-pointer"
        />
      </div>
    </div>,
    document.body
  )
}

function MobileSheet({ sheetRef, title, idBase, options, value, activeIndex, setActiveIndex, onPick, onClose }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[250]"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      <div className="fixed inset-0 bg-black/50 motion-safe:animate-fade-in touch-none" onClick={() => onClose(true)} />
      <div
        ref={sheetRef}
        className="fixed inset-x-0 bottom-0 z-[251] rounded-t-2xl bg-td-bg2 dark:bg-tn-bg2 shadow-e3 motion-safe:animate-slide-up flex flex-col max-h-[70vh] p-4 pt-3"
        style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="shrink-0 pb-3">
          <div className="mx-auto w-10 h-1 rounded-full bg-td-border dark:bg-tn-border mb-3" />
          <h2 className="text-center text-sm font-semibold text-td-fg dark:text-tn-fg">{title}</h2>
        </div>
        <SelectList
          idBase={idBase}
          options={options}
          value={value}
          activeIndex={activeIndex}
          setActiveIndex={setActiveIndex}
          onPick={onPick}
          className="rounded-xl border border-td-border/50 dark:border-tn-border/50 bg-td-surface dark:bg-tn-surface divide-y divide-td-border/30 dark:divide-tn-border/30 overflow-y-auto overscroll-contain outline-none"
          itemClassName="min-h-[48px] px-4 text-base active:bg-td-border/40 dark:active:bg-tn-border/40"
        />
      </div>
    </div>,
    document.body
  )
}

export function Select({
  value,
  onChange,
  options,
  variant = 'field',
  ariaLabel,
  title,
  placeholder = '',
  className = '',
}) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const typeaheadRef = useRef('')
  const typeaheadTimer = useRef(null)
  const isMobile = useIsMobile()
  const idBase = useId().replace(/:/g, '-')

  const enabledSelectedIndex = useMemo(() => {
    const current = options.findIndex(o => o.value === value && !o.disabled)
    return current >= 0 ? current : firstEnabledIndex(options)
  }, [options, value])

  const close = useCallback((restoreFocus = true) => {
    setOpen(false)
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus())
  }, [])

  const openMenu = useCallback(() => {
    setActiveIndex(enabledSelectedIndex)
    setOpen(true)
  }, [enabledSelectedIndex])

  const pick = useCallback((nextValue) => {
    onChange(nextValue)
    close(true)
  }, [onChange, close])

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      const target = menuRef.current?.matches?.('[role="listbox"]')
        ? menuRef.current
        : menuRef.current?.querySelector?.('[role="listbox"]')
      target?.focus?.()
    })
  }, [open, isMobile])

  useEffect(() => {
    if (!open) return

    const findByTypeahead = (char) => {
      clearTimeout(typeaheadTimer.current)
      typeaheadRef.current = `${typeaheadRef.current}${char}`.toLowerCase()
      typeaheadTimer.current = setTimeout(() => { typeaheadRef.current = '' }, 600)
      const query = typeaheadRef.current
      const start = Math.max(0, activeIndex + 1)
      const ordered = [...options.slice(start), ...options.slice(0, start)]
      const found = ordered.find(o => !o.disabled && o.label.toLowerCase().startsWith(query))
      if (!found) return
      setActiveIndex(options.indexOf(found))
    }

    const onKey = (e) => {
      const consume = () => {
        e.preventDefault()
        e.stopPropagation()
      }

      switch (e.key) {
        case 'ArrowDown':
          consume()
          setActiveIndex(i => moveEnabled(options, i < 0 ? firstEnabledIndex(options) : i, 1))
          break
        case 'ArrowUp':
          consume()
          setActiveIndex(i => moveEnabled(options, i < 0 ? firstEnabledIndex(options) : i, -1))
          break
        case 'Home':
          consume()
          setActiveIndex(firstEnabledIndex(options, 0))
          break
        case 'End':
          consume()
          for (let i = options.length - 1; i >= 0; i--) {
            if (!options[i].disabled) { setActiveIndex(i); break }
          }
          break
        case 'Enter':
        case ' ':
          consume()
          if (activeIndex >= 0 && !options[activeIndex]?.disabled) pick(options[activeIndex].value)
          break
        case 'Escape':
          consume()
          close(true)
          break
        case 'Tab':
          e.stopPropagation()
          close(false)
          break
        default:
          if (isPrintableKey(e)) {
            consume()
            findByTypeahead(e.key)
          }
          break
      }
    }

    window.addEventListener('keydown', onKey, { capture: true })
    return () => {
      window.removeEventListener('keydown', onKey, { capture: true })
      clearTimeout(typeaheadTimer.current)
      typeaheadRef.current = ''
    }
  }, [open, options, activeIndex, pick, close])

  const triggerKeyDown = (e) => {
    if ([' ', 'Enter', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault()
      e.stopPropagation()
      openMenu()
    }
  }

  const label = optionLabel(options, value, placeholder)
  const commonTrigger = {
    ref: triggerRef,
    type: 'button',
    role: 'combobox',
    'aria-haspopup': 'listbox',
    'aria-expanded': open,
    'aria-label': ariaLabel,
    'data-select-trigger': '',
    onClick: () => open ? close(false) : openMenu(),
    onKeyDown: triggerKeyDown,
  }

  if (variant === 'overlay') {
    return (
      <>
        <button {...commonTrigger} className={`absolute inset-0 w-full cursor-pointer opacity-0 ${className}`} />
        {open && (isMobile ? (
          <MobileSheet sheetRef={menuRef} title={title || ariaLabel} idBase={idBase} options={options} value={value} activeIndex={activeIndex} setActiveIndex={setActiveIndex} onPick={pick} onClose={close} />
        ) : (
          <DesktopMenu triggerRef={triggerRef} menuRef={menuRef} idBase={idBase} variant={variant} options={options} value={value} activeIndex={activeIndex} setActiveIndex={setActiveIndex} onPick={pick} onClose={close} />
        ))}
      </>
    )
  }

  const triggerClasses = variant === 'compact'
    ? 'relative inline-flex items-center text-left text-xs pl-2.5 pr-6 min-h-[40px] rounded-lg border border-td-border/50 dark:border-tn-border/50 bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-td-blue/50 dark:focus-visible:ring-tn-blue/50'
    : 'relative w-full flex items-center text-left px-3 py-2.5 rounded-xl text-sm bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg border border-transparent focus:border-td-blue/50 dark:focus:border-tn-blue/50 outline-none transition-colors cursor-pointer'

  return (
    <>
      <button {...commonTrigger} className={[triggerClasses, className].filter(Boolean).join(' ')}>
        <span className={label ? 'truncate' : 'truncate text-td-muted/50 dark:text-tn-muted/50'}>{label || placeholder}</span>
        <ChevronDown size={variant === 'compact' ? 10 : 14} className="absolute right-2 top-1/2 -translate-y-1/2 text-td-muted dark:text-tn-muted pointer-events-none" />
      </button>
      {open && (isMobile ? (
        <MobileSheet sheetRef={menuRef} title={title || ariaLabel} idBase={idBase} options={options} value={value} activeIndex={activeIndex} setActiveIndex={setActiveIndex} onPick={pick} onClose={close} />
      ) : (
        <DesktopMenu triggerRef={triggerRef} menuRef={menuRef} idBase={idBase} variant={variant} options={options} value={value} activeIndex={activeIndex} setActiveIndex={setActiveIndex} onPick={pick} onClose={close} />
      ))}
    </>
  )
}
