import { useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { STATUS_DISPLAY_LABELS } from '../tasks/grouping'

function DonutTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload

  return (
    <div className="rounded-xl border border-td-border/70 dark:border-tn-border/70 bg-td-bg2/95 dark:bg-tn-bg2/95 p-3 shadow-e3 backdrop-blur">
      <div className="mb-1 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
        <span className="text-xs font-medium text-td-fg dark:text-tn-fg">{item.name}</span>
      </div>
      <p className="text-[11px] text-td-muted dark:text-tn-muted">
        {item.value} task{item.value !== 1 ? 's' : ''} · {item.percentage}%
      </p>
    </div>
  )
}

export function StatusDonutChart({ data }) {
  const { state } = useApp()
  const isDark = state.theme === 'dark'

  const chartData = useMemo(() => {
    const colors = {
      todo: isDark ? '#565f89' : '#8b93b8',
      doing: isDark ? '#89b4fa' : '#2e7de9',
      blocked: '#f7768e',
      done: isDark ? '#9ece6a' : '#65a30d',
    }
    const entries = Object.entries(data).filter(([, count]) => count > 0)
    const total = entries.reduce((sum, [, count]) => sum + count, 0)

    return entries.map(([status, count]) => ({
      name: STATUS_DISPLAY_LABELS[status] || status,
      value: count,
      status,
      color: colors[status] || colors.todo,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
  }, [data, isDark])

  const total = chartData.reduce((sum, item) => sum + item.value, 0)

  if (chartData.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-td-muted dark:text-tn-muted">
        No tasks yet
      </div>
    )
  }

  return (
    <div className="grid h-full grid-cols-1 items-center gap-4 sm:grid-cols-[180px_1fr]">
      <div className="relative mx-auto h-44 w-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={57}
              outerRadius={78}
              paddingAngle={3}
              cornerRadius={5}
              dataKey="value"
              stroke="none"
            >
              {chartData.map(entry => <Cell key={entry.status} fill={entry.color} />)}
            </Pie>
            <Tooltip content={<DonutTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tracking-tight text-td-fg dark:text-tn-fg">{total}</span>
          <span className="text-[10px] uppercase tracking-wider text-td-muted dark:text-tn-muted">tasks</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {chartData.map(item => (
          <div
            key={item.status}
            className="rounded-xl border border-td-border/40 dark:border-tn-border/40 bg-td-bg/50 dark:bg-tn-bg/40 p-3"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-xs text-td-muted dark:text-tn-muted">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: item.color }} />
                <span className="truncate">{item.name}</span>
              </span>
              <span className="text-sm font-semibold tabular-nums text-td-fg dark:text-tn-fg">{item.value}</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-td-surface dark:bg-tn-surface">
              <div className="h-full rounded-full" style={{ width: `${item.percentage}%`, background: item.color }} />
            </div>
            <div className="mt-1.5 text-right text-[10px] tabular-nums text-td-muted/70 dark:text-tn-muted/70">
              {item.percentage}%
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
