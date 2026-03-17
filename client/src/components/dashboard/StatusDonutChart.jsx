import { useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

export function StatusDonutChart({ data }) {
  const { state } = useApp()
  const isDark = state.theme === 'dark'

  // Status colors matching Tokyo Night theme
  const STATUS_COLORS = {
    todo: isDark ? '#565f89' : '#a9b1d6',
    doing: isDark ? '#7aa2f7' : '#7aa2f7',
    blocked: isDark ? '#f7768e' : '#f7768e',
    done: isDark ? '#9ece6a' : '#9ece6a',
  }

  const chartData = useMemo(() => {
    return Object.entries(data)
      .filter(([_, count]) => count > 0)
      .map(([status, count]) => ({
        name: status.charAt(0).toUpperCase() + status.slice(1),
        value: count,
        status,
        color: STATUS_COLORS[status] || STATUS_COLORS.todo
      }))
  }, [data])

  const total = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.value, 0)
  }, [chartData])

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null

    const data = payload[0].payload
    const percentage = ((data.value / total) * 100).toFixed(1)

    return (
      <div className="bg-td-bg2 dark:bg-tn-bg2 border border-td-border dark:border-tn-border rounded-lg p-3 shadow-xl">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full" style={{ background: data.color }} />
          <span className="text-sm text-td-fg dark:text-tn-fg font-medium">
            {data.name}
          </span>
        </div>
        <div className="text-xs text-td-muted dark:text-tn-muted">
          {data.value} tasks ({percentage}%)
        </div>
      </div>
    )
  }

  if (chartData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-td-muted dark:text-tn-muted text-sm">
        No tasks yet
      </div>
    )
  }

  return (
    <div className="h-full flex items-center">
      <div className="flex-1">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex-1 space-y-2">
        {chartData.map((item) => {
          const percentage = ((item.value / total) * 100).toFixed(1)
          return (
            <div key={item.status} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: item.color }} />
                <span className="text-sm text-td-fg dark:text-tn-fg truncate">{item.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm text-td-fg dark:text-tn-fg font-medium">{item.value}</span>
                <span className="text-xs text-td-muted dark:text-tn-muted w-12 text-right">
                  {percentage}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
