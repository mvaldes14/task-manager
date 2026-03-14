import { useRef, useCallback } from 'react'

const THRESHOLD = 72   // px to pull before triggering
const MAX_PULL  = 96   // max visual stretch

export function usePullToRefresh(onRefresh) {
  const startY      = useRef(null)
  const pulling     = useRef(false)
  const indicatorEl = useRef(null)

  const setIndicator = (progress) => {
    const el = indicatorEl.current
    if (!el) return
    if (progress <= 0) {
      el.style.height = '0px'
      el.style.opacity = '0'
    } else {
      const h = Math.min(progress, MAX_PULL)
      el.style.height = `${h}px`
      el.style.opacity = `${Math.min(progress / THRESHOLD, 1)}`
      // Rotate the arrow based on pull progress
      const rotate = Math.min((progress / THRESHOLD) * 180, 180)
      const arrow = el.querySelector('[data-arrow]')
      if (arrow) arrow.style.transform = `rotate(${rotate}deg)`
    }
  }

  const onTouchStart = useCallback((e) => {
    const el = e.currentTarget
    if (el.scrollTop > 0) return  // only trigger at top
    startY.current = e.touches[0].clientY
    pulling.current = false
  }, [])

  const onTouchMove = useCallback((e) => {
    if (startY.current === null) return
    const el = e.currentTarget
    if (el.scrollTop > 0) { startY.current = null; return }
    const delta = e.touches[0].clientY - startY.current
    if (delta <= 0) return
    pulling.current = true
    setIndicator(delta * 0.6)  // slight resistance
  }, [])

  const onTouchEnd = useCallback(async () => {
    if (!pulling.current || startY.current === null) return
    const el = indicatorEl.current
    const currentH = el ? parseFloat(el.style.height) || 0 : 0

    if (currentH >= THRESHOLD * 0.6) {
      // Show spinner while refreshing
      if (el) {
        el.style.height = `${THRESHOLD * 0.6}px`
        el.style.opacity = '1'
        const arrow = el.querySelector('[data-arrow]')
        const spinner = el.querySelector('[data-spinner]')
        if (arrow) arrow.style.display = 'none'
        if (spinner) spinner.style.display = 'block'
      }
      await onRefresh()
    }

    // Reset
    setIndicator(0)
    if (el) {
      const arrow = el.querySelector('[data-arrow]')
      const spinner = el.querySelector('[data-spinner]')
      if (arrow) { arrow.style.display = 'block'; arrow.style.transform = '' }
      if (spinner) spinner.style.display = 'none'
    }
    startY.current = null
    pulling.current = false
  }, [onRefresh])

  return { indicatorEl, onTouchStart, onTouchMove, onTouchEnd }
}
