import { useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

function TrendTooltip({ active, payload, label }) {
  const entries = payload?.filter(entry => entry?.dataKey) || []
  if (!active || entries.length === 0) return null

  return (
    <div className="min-w-36 rounded-xl border border-td-border/70 dark:border-tn-border/70 bg-td-bg2/95 dark:bg-tn-bg2/95 p-3 shadow-e3 backdrop-blur">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-td-muted dark:text-tn-muted">{label}</p>
      <div className="space-y-1.5">
        {entries.map(entry => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-5 text-xs">
            <span className="flex items-center gap-2 text-td-muted dark:text-tn-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
              {entry.name}
            </span>
            <span className="font-semibold tabular-nums text-td-fg dark:text-tn-fg">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CompletionTrendChart({ data }) {
  const { state } = useApp()
  const isDark = state.theme === 'dark'
  const colors = {
    completed: isDark ? '#9ece6a' : '#65a30d',
    created: isDark ? '#89b4fa' : '#2e7de9',
    grid: isDark ? '#20222a' : '#d8deee',
    text: isDark ? '#787c99' : '#7b8194',
  }

  const chartData = useMemo(() => data.map(d => ({
    ...d,
    date: new Date(`${d.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  })), [data])

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-4 text-[11px] text-td-muted dark:text-tn-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: colors.completed }} />
          Completed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: colors.created }} />
          Created
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 6, right: 6, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="trendCompleted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.completed} stopOpacity={0.24} />
                <stop offset="100%" stopColor={colors.completed} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="trendCreated" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.created} stopOpacity={0.18} />
                <stop offset="100%" stopColor={colors.created} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="2 6" opacity={0.65} />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              minTickGap={28}
              tick={{ fill: colors.text, fontSize: 10 }}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={32}
              tick={{ fill: colors.text, fontSize: 10 }}
            />
            <Tooltip
              content={<TrendTooltip />}
              cursor={{ stroke: colors.grid, strokeWidth: 1, strokeDasharray: '3 3' }}
            />
            <Area
              type="monotone"
              dataKey="created"
              name="Created"
              stroke={colors.created}
              strokeWidth={2}
              fill="url(#trendCreated)"
              activeDot={{ r: 4, strokeWidth: 2, fill: colors.created, stroke: isDark ? '#08090c' : '#fff' }}
            />
            <Area
              type="monotone"
              dataKey="completed"
              name="Completed"
              stroke={colors.completed}
              strokeWidth={2.5}
              fill="url(#trendCompleted)"
              activeDot={{ r: 4, strokeWidth: 2, fill: colors.completed, stroke: isDark ? '#08090c' : '#fff' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
