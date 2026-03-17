import { useMemo } from 'react'
import { useApp } from '../../context/AppContext'

export function ActivityHeatmap({ data, period }) {
  const { state } = useApp()
  const isDark = state.theme === 'dark'

  // Build a map of date -> count
  const activityMap = useMemo(() => {
    const map = {}
    data.forEach(d => {
      map[d.date] = d.count
    })
    return map
  }, [data])

  // Generate grid of dates
  const grid = useMemo(() => {
    const today = new Date()
    const startDate = new Date(today)
    startDate.setDate(today.getDate() - (period - 1))

    const weeks = []
    let currentWeek = []
    let currentDate = new Date(startDate)

    // Start from the beginning of the week
    const dayOfWeek = currentDate.getDay()
    currentDate.setDate(currentDate.getDate() - dayOfWeek)

    while (currentDate <= today) {
      const dateStr = currentDate.toISOString().split('T')[0]
      const count = activityMap[dateStr] || 0
      const isInRange = currentDate >= startDate && currentDate <= today

      currentWeek.push({
        date: new Date(currentDate),
        dateStr,
        count,
        isInRange
      })

      if (currentWeek.length === 7) {
        weeks.push(currentWeek)
        currentWeek = []
      }

      currentDate.setDate(currentDate.getDate() + 1)
    }

    if (currentWeek.length > 0) {
      weeks.push(currentWeek)
    }

    return weeks
  }, [activityMap, period])

  // Get max count for color intensity
  const maxCount = useMemo(() => {
    return Math.max(...data.map(d => d.count), 1)
  }, [data])

  const getColor = (count, isInRange) => {
    if (!isInRange || count === 0) {
      return isDark ? '#1a1b26' : '#e5e7eb'
    }
    const intensity = count / maxCount
    if (isDark) {
      // Tokyo Night green with varying opacity
      const alpha = Math.max(0.2, intensity)
      return `rgba(158, 206, 106, ${alpha})`
    } else {
      const alpha = Math.max(0.2, intensity)
      return `rgba(158, 206, 106, ${alpha})`
    }
  }

  const formatTooltipDate = (date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-0.5 overflow-x-auto pb-2">
        {grid.map((week, weekIdx) => (
          <div key={weekIdx} className="flex flex-col gap-0.5">
            {week.map((day, dayIdx) => (
              <div
                key={dayIdx}
                className="relative group"
                title={`${formatTooltipDate(day.date)}: ${day.count} task${day.count !== 1 ? 's' : ''} completed`}
              >
                <div
                  className="w-3 h-3 rounded-sm transition-all hover:ring-2 hover:ring-td-blue dark:hover:ring-tn-blue"
                  style={{
                    backgroundColor: getColor(day.count, day.isInRange),
                    opacity: day.isInRange ? 1 : 0.3
                  }}
                />
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-td-bg2 dark:bg-tn-bg2 border border-td-border dark:border-tn-border rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                  <div className="text-td-fg dark:text-tn-fg font-medium">
                    {formatTooltipDate(day.date)}
                  </div>
                  <div className="text-td-muted dark:text-tn-muted text-[10px]">
                    {day.count} completed
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 text-xs text-td-muted dark:text-tn-muted">
        <span>Less</span>
        <div className="flex gap-0.5">
          {[0, 0.25, 0.5, 0.75, 1].map((intensity, i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-sm"
              style={{
                backgroundColor: getColor(Math.ceil(maxCount * intensity), true)
              }}
            />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  )
}
