import { useState, useCallback } from 'react'

/**
 * Inline autocomplete for FAB input.
 * Triggers on '@' (tags) and '#' (projects).
 * Returns { suggestions, onInput, onSelect, closeSuggestions }
 */
export function useInlineAutocomplete({ text, setText, inputRef, allTags, projects }) {
  const [suggestions, setSuggestions] = useState([])   // [{ label, value, type }]
  const [triggerStart, setTriggerStart] = useState(-1) // index of the @ or # char

  const onInput = useCallback((val) => {
    const el = inputRef.current
    const pos = el ? el.selectionStart : val.length
    // Scan backwards from cursor for a trigger character
    let i = pos - 1
    while (i >= 0 && val[i] !== ' ' && val[i] !== '@' && val[i] !== '#') i--
    if (i < 0 || (val[i] !== '@' && val[i] !== '#')) {
      setSuggestions([]); setTriggerStart(-1); return
    }
    const trigger = val[i]
    const query = val.slice(i + 1, pos).toLowerCase()
    setTriggerStart(i)
    if (trigger === '@') {
      const matches = allTags
        .filter(t => t.toLowerCase().startsWith(query))
        .slice(0, 6)
        .map(t => ({ label: '@' + t, value: t, type: 'tag' }))
      setSuggestions(matches)
    } else {
      const matches = projects
        .filter(p => p.name.toLowerCase().startsWith(query))
        .slice(0, 6)
        .map(p => ({ label: p.name, value: p.name, type: 'project' }))
      setSuggestions(matches)
    }
  }, [allTags, projects, inputRef])

  const onSelect = useCallback((item) => {
    if (triggerStart < 0) return
    const el = inputRef.current
    const pos = el ? el.selectionStart : text.length
    // Replace from triggerStart to cursor with the chosen value
    const before = text.slice(0, triggerStart)
    const after  = text.slice(pos)
    const trigger = text[triggerStart]
    const inserted = trigger + item.value + ' '
    const next = before + inserted + after
    setText(next)
    setSuggestions([]); setTriggerStart(-1)
    // Restore focus + move cursor after insertion
    setTimeout(() => {
      if (el) {
        el.focus()
        const cur = before.length + inserted.length
        el.setSelectionRange(cur, cur)
      }
    }, 0)
  }, [text, setText, triggerStart, inputRef])

  const closeSuggestions = useCallback(() => {
    setSuggestions([]); setTriggerStart(-1)
  }, [])

  return { suggestions, onInput, onSelect, closeSuggestions }
}
