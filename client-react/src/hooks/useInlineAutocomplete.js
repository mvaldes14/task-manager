import { useState, useCallback } from 'react'

/**
 * Detects @ or # trigger in an input value and returns matching suggestions.
 * On pick, inserts the selected item inline and clears the dropdown.
 *
 * @param {object} opts
 * @param {string[]} opts.tags     - all known tags
 * @param {object[]} opts.projects - all known projects [{id, name}]
 */
export function useInlineAutocomplete({ tags = [], projects = [] }) {
  const [suggestions, setSuggestions] = useState([])
  const [trigger, setTrigger] = useState(null) // '@' | '#' | null
  const [triggerIndex, setTriggerIndex] = useState(-1)

  const onInputChange = useCallback((value) => {
    // Find the last unfinished @ or # token (no space after it yet)
    const atMatch  = [...value.matchAll(/@(\w*)$/g)].pop()
    const hashMatch = [...value.matchAll(/#(\w*)$/g)].pop()

    let match = null
    let t = null

    if (atMatch && (!hashMatch || atMatch.index > hashMatch.index)) {
      match = atMatch; t = '@'
    } else if (hashMatch) {
      match = hashMatch; t = '#'
    }

    if (!match) { setSuggestions([]); setTrigger(null); return }

    const query = match[1].toLowerCase()
    setTrigger(t)
    setTriggerIndex(match.index)

    if (t === '@') {
      setSuggestions(
        tags.filter(tag => tag.toLowerCase().includes(query)).slice(0, 8)
      )
    } else {
      setSuggestions(
        projects
          .filter(p => p.name.toLowerCase().includes(query))
          .map(p => p.name)
          .slice(0, 8)
      )
    }
  }, [tags, projects])

  const onPick = useCallback((value, picked) => {
    // Replace from triggerIndex to end-of-current-token with the picked value + space
    const before = value.slice(0, triggerIndex)
    const newValue = `${before}${trigger}${picked} `
    setSuggestions([])
    setTrigger(null)
    return newValue
  }, [trigger, triggerIndex])

  const dismiss = useCallback(() => {
    setSuggestions([])
    setTrigger(null)
  }, [])

  return { suggestions, trigger, onInputChange, onPick, dismiss }
}
