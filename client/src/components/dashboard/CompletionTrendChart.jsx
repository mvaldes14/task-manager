import { useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

export function CompletionTrendChart({ data }) {
  const { state } = useApp()
  const isDark = state.theme === 'dark'

  // Theme colors
  const colors = {
    completed: isDark ? '#9ece6a' : '#9ece6a',
    created: isDark ? '#7aa2f7' : '#7aa2f7',
    grid: isDark ? '#414868' : '#e0e7ff',
    text: isDark ? '#c0caf5' : '#24283b',
    bg: isDark ? '#1a1b26' : '#ffffff',
  }

  const chartData = useMemo(() => {
    return data.map(d => ({
      ...d,
      date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }))
  }, [data])

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null

    return (
      <div className="bg-td-bg2 dark:bg-tn-bg2 border border-td-border dark:border-tn-border rounded-lg p-3 shadow-xl">
        <p className="text-xs text-td-muted dark:text-tn-muted mb-2">{payload[0].payload.date}</p>
        <div className="space-y-1">
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
              <span className="text-xs text-td-fg dark:text-tn-fg font-medium">
                {entry.name}: {entry.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colors.completed} stopOpacity={0.3}/>
            <stop offset="95%" stopColor={colors.completed} stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colors.created} stopOpacity={0.3}/>
            <stop offset="95%" stopColor={colors.created} stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} opacity={0.3} />
        <XAxis
          dataKey="date"
          stroke={colors.text}
          tick={{ fill: colors.text, fontSize: 11 }}
          tickLine={{ stroke: colors.grid }}
        />
        <YAxis
          stroke={colors.text}
          tick={{ fill: colors.text, fontSize: 11 }}
          tickLine={{ stroke: colors.grid }}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: '12px' }}
          iconType="circle"
        />
        <Area
          type="monotone"
          dataKey="completed"
          name="Completed"
          stroke={colors.completed}
          strokeWidth={2}
          fill="url(#colorCompleted)"
        />
        <Area
          type="monotone"
          dataKey="created"
          name="Created"
          stroke={colors.created}
          strokeWidth={2}
          fill="url(#colorCreated)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
