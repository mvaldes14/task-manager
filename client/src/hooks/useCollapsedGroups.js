import { useCallback, useState } from 'react'

const STORAGE_KEY = 'td-collapsed-groups'

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return new Set(Array.isArray(saved) ? saved : [])
  } catch {
    return new Set()
  }
}

function save(set) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
}

export function useCollapsedGroups() {
  const [collapsed, setCollapsed] = useState(load)

  const isCollapsed = useCallback(key => collapsed.has(key), [collapsed])

  const toggle = useCallback(key => {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      save(next)
      return next
    })
  }, [])

  const collapseAll = useCallback(keys => {
    setCollapsed(() => {
      const next = new Set(keys)
      save(next)
      return next
    })
  }, [])

  const expandAll = useCallback(() => {
    setCollapsed(() => {
      const next = new Set()
      save(next)
      return next
    })
  }, [])

  return { isCollapsed, toggle, collapseAll, expandAll }
}
