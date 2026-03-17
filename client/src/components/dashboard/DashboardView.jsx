import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../api'
import { TrendingUp, CheckCircle2, ListTodo, Calendar, AlertCircle, Flame, Target } from 'lucide-react'
import { CompletionTrendChart } from './CompletionTrendChart'
import { ActivityHeatmap } from './ActivityHeatmap'
import { StatusDonutChart } from './StatusDonutChart'

function StatCard({ icon: Icon, label, value, subtitle, trend, color = 'blue' }) {
  const colorClasses = {
    blue:   'bg-td-blue/10 dark:bg-tn-blue/10 text-td-blue dark:text-tn-blue',
    green:  'bg-td-green/10 dark:bg-tn-green/10 text-td-green dark:text-tn-green',
    red:    'bg-td-red/10 dark:bg-tn-red/10 text-td-red dark:text-tn-red',
    orange: 'bg-td-amber/10 dark:bg-tn-amber/10 text-td-amber dark:text-tn-amber',
    purple: 'bg-td-purple/10 dark:bg-tn-purple/10 text-td-purple dark:text-tn-purple',
  }

  return (
    <div className="bg-td-bg2 dark:bg-tn-bg2 rounded-xl p-4 border border-td-border/50 dark:border-tn-border/50">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon size={18} />
        </div>
        {trend && (
          <div className="text-xs text-td-green dark:text-tn-green flex items-center gap-1">
            <TrendingUp size={12} />
            {trend}
          </div>
        )}
      </div>
      <div className="text-3xl font-bold text-td-fg dark:text-tn-fg mb-1">
        {value}
      </div>
      <div className="text-xs text-td-muted dark:text-tn-muted font-medium">
        {label}
      </div>
      {subtitle && (
        <div className="text-[10px] text-td-muted/60 dark:text-tn-muted/60 mt-1">
          {subtitle}
        </div>
      )}
    </div>
  )
}

function SectionHeader({ children }) {
  return (
    <h3 className="text-sm font-bold text-td-fg dark:text-tn-fg mb-3">
      {children}
    </h3>
  )
}

export function DashboardView() {
  const { state } = useApp()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(30)

  useEffect(() => {
    loadStats()
  }, [period])

  const loadStats = async () => {
    setLoading(true)
    try {
      const data = await api.getDashboardStats(period)
      setStats(data)
    } catch (err) {
      console.error('Failed to load dashboard stats:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-td-muted dark:text-tn-muted">Loading dashboard...</div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-td-red dark:text-tn-red">Failed to load dashboard</div>
      </div>
    )
  }

  const { counts, insights, projects, tags, completion_trend, activity_heatmap } = stats

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-td-fg dark:text-tn-fg">Dashboard</h1>
            <p className="text-sm text-td-muted dark:text-tn-muted mt-1">
              Your productivity overview
            </p>
          </div>
          <div className="flex gap-2">
            {[7, 30, 90].map(days => (
              <button
                key={days}
                onClick={() => setPeriod(days)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                  ${period === days
                    ? 'bg-td-blue dark:bg-tn-blue text-white'
                    : 'bg-td-surface dark:bg-tn-surface text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg'
                  }`}
              >
                {days}d
              </button>
            ))}
          </div>
        </div>

        {/* Hero Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <StatCard
            icon={CheckCircle2}
            label={`Completed (${period}d)`}
            value={counts.completed_period}
            color="green"
          />
          <StatCard
            icon={ListTodo}
            label="Active Tasks"
            value={counts.total_active}
            color="blue"
          />
          <StatCard
            icon={Flame}
            label="Current Streak"
            value={`${insights.current_streak} days`}
            subtitle={`Longest: ${insights.longest_streak} days`}
            color="orange"
          />
          <StatCard
            icon={Calendar}
            label="Due Today"
            value={counts.due_today}
            color="purple"
          />
          <StatCard
            icon={AlertCircle}
            label="Overdue"
            value={counts.overdue}
            color="red"
          />
          <StatCard
            icon={Target}
            label="Completion Rate"
            value={`${Math.round(insights.completion_rate * 100)}%`}
            subtitle={`Avg ${insights.avg_per_day}/day`}
            color="blue"
          />
        </div>

        {/* Completion Trend */}
        <div className="bg-td-bg2 dark:bg-tn-bg2 rounded-xl p-6 border border-td-border/50 dark:border-tn-border/50">
          <SectionHeader>Completion Trend</SectionHeader>
          <div className="h-64">
            <CompletionTrendChart data={completion_trend} />
          </div>
        </div>

        {/* Activity Heatmap */}
        <div className="bg-td-bg2 dark:bg-tn-bg2 rounded-xl p-6 border border-td-border/50 dark:border-tn-border/50">
          <SectionHeader>Activity Calendar</SectionHeader>
          <ActivityHeatmap data={activity_heatmap} period={period} />
        </div>

        {/* Status Distribution */}
        <div className="bg-td-bg2 dark:bg-tn-bg2 rounded-xl p-6 border border-td-border/50 dark:border-tn-border/50">
          <SectionHeader>Status Distribution</SectionHeader>
          <StatusDonutChart data={counts.by_status} />
        </div>

        {/* Projects & Tags */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Projects */}
          <div className="bg-td-bg2 dark:bg-tn-bg2 rounded-xl p-6 border border-td-border/50 dark:border-tn-border/50">
            <SectionHeader>Tasks by Project</SectionHeader>
            <div className="space-y-3">
              {projects.slice(0, 8).map(proj => (
                <div key={proj.id} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="text-sm text-td-fg dark:text-tn-fg font-medium mb-1">
                      {proj.name}
                    </div>
                    <div className="h-2 bg-td-surface dark:bg-tn-surface rounded-full overflow-hidden">
                      <div
                        className="h-full bg-td-blue dark:bg-tn-blue"
                        style={{ width: `${proj.total > 0 ? (proj.completed / proj.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-td-muted dark:text-tn-muted whitespace-nowrap">
                    {proj.completed}/{proj.total}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="bg-td-bg2 dark:bg-tn-bg2 rounded-xl p-6 border border-td-border/50 dark:border-tn-border/50">
            <SectionHeader>Top Tags</SectionHeader>
            <div className="space-y-2">
              {tags.slice(0, 10).map(tag => (
                <div key={tag.tag} className="flex items-center justify-between">
                  <span className="text-sm text-td-purple dark:text-tn-purple">
                    @{tag.tag}
                  </span>
                  <span className="text-xs text-td-muted dark:text-tn-muted">
                    {tag.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Insights */}
        <div className="bg-td-bg2 dark:bg-tn-bg2 rounded-xl p-6 border border-td-border/50 dark:border-tn-border/50">
          <SectionHeader>Quick Insights</SectionHeader>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="text-sm">
              <span className="text-td-muted dark:text-tn-muted">Most productive day:</span>
              <span className="ml-2 text-td-fg dark:text-tn-fg font-medium">
                {insights.best_day || 'N/A'}
              </span>
            </div>
            <div className="text-sm">
              <span className="text-td-muted dark:text-tn-muted">Average tasks/day:</span>
              <span className="ml-2 text-td-fg dark:text-tn-fg font-medium">
                {insights.avg_per_day}
              </span>
            </div>
            <div className="text-sm">
              <span className="text-td-muted dark:text-tn-muted">Longest streak:</span>
              <span className="ml-2 text-td-fg dark:text-tn-fg font-medium">
                {insights.longest_streak} days
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
