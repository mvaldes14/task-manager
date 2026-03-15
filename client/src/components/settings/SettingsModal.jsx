import { useState, useEffect } from 'react'
import { X, CalendarDays, Puzzle, Bell, Link, Upload, Trash2, Plus, CheckCircle2, RefreshCw } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { api } from '../../api'
import { useRef } from 'react'

const TABS = [
  { id: 'calendars',     label: 'Calendars',     icon: CalendarDays },
  { id: 'integrations',  label: 'Integrations',  icon: Puzzle },
  { id: 'notifications', label: 'Notifications', icon: Bell },
]

const COLORS = ['#bb9af7','#7aa2f7','#9ece6a','#f7768e','#ff9e64','#e0af68','#73daca','#7dcfff']

// ── Shared input style ────────────────────────────────────────────────────────
const inputCls = `w-full px-3 py-2.5 rounded-xl text-sm bg-td-surface dark:bg-tn-surface
  text-td-fg dark:text-tn-fg placeholder:text-td-muted/50 dark:placeholder:text-tn-muted/50
  border border-transparent focus:border-td-blue/50 dark:focus:border-tn-blue/50 outline-none transition-colors`

const labelCls = 'text-xs font-semibold text-td-muted dark:text-tn-muted'

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label className={labelCls}>{label}</label>
      {children}
      {hint && <p className="text-[11px] text-td-muted/60 dark:text-tn-muted/60">{hint}</p>}
    </div>
  )
}

function SaveButton({ onClick, saving, saved }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="px-4 py-2 rounded-xl text-sm font-medium bg-td-blue/10 dark:bg-tn-blue/10
        text-td-blue dark:text-tn-blue hover:bg-td-blue/20 dark:hover:bg-tn-blue/20
        transition-colors disabled:opacity-50 flex items-center gap-2"
    >
      {saving ? 'Saving…' : saved ? <><CheckCircle2 size={13} /> Saved</> : 'Save'}
    </button>
  )
}

// ── Calendars tab ─────────────────────────────────────────────────────────────
function CalendarsTab({ gcalEnabled }) {
  const [calendars, setCalendars] = useState([])
  const [tab, setTab] = useState('url')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef()

  const load = () => api.listIcs().then(c => setCalendars(c || [])).catch(() => {})
  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    if (tab === 'url' && !url.trim()) { setError('URL is required'); return }
    if (tab === 'file' && !file) { setError('Choose a file'); return }
    setError(null); setLoading(true)
    try {
      tab === 'url'
        ? await api.addIcsUrl(name.trim(), url.trim(), color)
        : await api.addIcsFile(name.trim(), color, file)
      setName(''); setUrl(''); setFile(null)
      await load()
    } catch (e) { setError(e.message || 'Failed to import') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-5">
      {/* GCal status */}
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-td-surface/50 dark:bg-tn-surface/50">
        <RefreshCw size={14} className={gcalEnabled ? 'text-td-green dark:text-tn-green' : 'text-td-muted/40 dark:text-tn-muted/40'} />
        <div className="flex-1">
          <p className="text-sm font-medium text-td-fg dark:text-tn-fg">Google Calendar</p>
          <p className="text-[11px] text-td-muted dark:text-tn-muted">{gcalEnabled ? 'Connected via service account' : 'Not connected — set GCAL_CREDENTIALS_JSON env var'}</p>
        </div>
        {gcalEnabled && <CheckCircle2 size={14} className="text-td-green dark:text-tn-green shrink-0" />}
      </div>

      {/* Imported ICS */}
      {calendars.length > 0 && (
        <div className="space-y-2">
          <p className={labelCls}>Imported Calendars</p>
          {calendars.map(cal => (
            <div key={cal.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-td-surface/50 dark:bg-tn-surface/50">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: cal.color }} />
              <span className="flex-1 text-sm text-td-fg dark:text-tn-fg font-medium truncate">{cal.name}</span>
              {cal.url && <Link size={11} className="text-td-muted/50 dark:text-tn-muted/50 shrink-0" />}
              <button onClick={() => api.deleteIcs(cal.id).then(load)}
                className="text-td-muted/40 dark:text-tn-muted/40 hover:text-td-red dark:hover:text-tn-red transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new */}
      <div className="space-y-3">
        <p className={labelCls}>Add Calendar</p>
        <div className="flex bg-td-surface dark:bg-tn-surface rounded-lg p-0.5">
          {['url', 'file'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors
                ${tab === t ? 'bg-td-bg2 dark:bg-tn-bg2 text-td-fg dark:text-tn-fg shadow-sm' : 'text-td-muted dark:text-tn-muted'}`}>
              {t === 'url' ? <><Link size={11} /> URL</> : <><Upload size={11} /> File</>}
            </button>
          ))}
        </div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Calendar name" className={inputCls} />
        {tab === 'url'
          ? <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…/feed.ics" className={inputCls} />
          : (
            <div>
              <input ref={fileRef} type="file" accept=".ics" className="hidden" onChange={e => setFile(e.target.files[0] || null)} />
              <button onClick={() => fileRef.current.click()}
                className={`${inputCls} border-dashed border border-td-border dark:border-tn-border text-td-muted dark:text-tn-muted text-left`}>
                {file ? file.name : 'Choose .ics file…'}
              </button>
            </div>
          )
        }
        <div className="flex items-center gap-2">
          <span className="text-xs text-td-muted dark:text-tn-muted shrink-0">Color</span>
          <div className="flex gap-1.5 flex-wrap">
            {COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)}
                className={`w-5 h-5 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-offset-td-bg2 dark:ring-offset-tn-bg2 ring-white/70 scale-110' : 'hover:scale-105'}`}
                style={{ background: c }} />
            ))}
          </div>
        </div>
        {error && <p className="text-xs text-td-red dark:text-tn-red">{error}</p>}
        <button onClick={handleAdd} disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium
            bg-td-blue/10 dark:bg-tn-blue/10 text-td-blue dark:text-tn-blue
            hover:bg-td-blue/20 dark:hover:bg-tn-blue/20 transition-colors disabled:opacity-50">
          {loading ? 'Importing…' : <><Plus size={14} /> Import Calendar</>}
        </button>
      </div>
    </div>
  )
}

// ── Integrations tab ──────────────────────────────────────────────────────────
function IntegrationsTab() {
  const { dispatch } = useApp()
  const [vault, setVault] = useState('')
  const [inbox, setInbox] = useState('')
  const [otel, setOtel] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.getSettings().then(s => {
      if (!s) return
      setVault(s.obsidian_vault || '')
      setInbox(s.obsidian_inbox || '')
      setOtel(s.otel_frontend_endpoint || '')
    }).catch(() => {})
  }, [])

  const save = async () => {
    setSaving(true); setSaved(false)
    try {
      const updated = await api.updateSettings({
        obsidian_vault: vault.trim() || null,
        obsidian_inbox: inbox.trim() || null,
        otel_frontend_endpoint: otel.trim() || null,
      })
      if (updated) dispatch({ type: 'SET_SETTINGS', payload: updated })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <p className={labelCls}>Obsidian</p>
        <Field label="Vault name" hint="Used to generate obsidian:// links when creating tasks with !note">
          <input value={vault} onChange={e => setVault(e.target.value)} placeholder="my-vault" className={inputCls} />
        </Field>
        <Field label="Inbox folder" hint="New notes are created here (e.g. 00-Inbox)">
          <input value={inbox} onChange={e => setInbox(e.target.value)} placeholder="00-Inbox" className={inputCls} />
        </Field>
      </div>

      <div className="border-t border-td-border/30 dark:border-tn-border/30 pt-4 space-y-4">
        <p className={labelCls}>OpenTelemetry</p>
        <Field label="Frontend OTLP/HTTP endpoint" hint="Browser traces are sent here. Leave empty to disable.">
          <input value={otel} onChange={e => setOtel(e.target.value)} placeholder="https://signoz:4318" className={inputCls} />
        </Field>
      </div>

      <div className="flex justify-end">
        <SaveButton onClick={save} saving={saving} saved={saved} />
      </div>
    </div>
  )
}

// ── Notifications tab ─────────────────────────────────────────────────────────
function NotificationsTab() {
  const [type, setType] = useState('')
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.getSettings().then(s => {
      if (!s) return
      setType(s.notification_type || '')
      setUrl(s.notification_url || '')
    }).catch(() => {})
  }, [])

  const save = async () => {
    setSaving(true); setSaved(false)
    try {
      await api.updateSettings({
        notification_type: type || null,
        notification_url: url.trim() || null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-5">
      <Field label="Notification service">
        <div className="flex bg-td-surface dark:bg-tn-surface rounded-lg p-0.5">
          {[['', 'None'], ['ntfy', 'ntfy'], ['gotify', 'Gotify']].map(([val, lbl]) => (
            <button key={val} onClick={() => setType(val)}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors
                ${type === val ? 'bg-td-bg2 dark:bg-tn-bg2 text-td-fg dark:text-tn-fg shadow-sm' : 'text-td-muted dark:text-tn-muted'}`}>
              {lbl}
            </button>
          ))}
        </div>
      </Field>

      {type && (
        <Field
          label={type === 'ntfy' ? 'ntfy topic URL' : 'Gotify server URL'}
          hint={type === 'ntfy' ? 'e.g. https://ntfy.sh/my-topic' : 'e.g. https://gotify.example.com'}
        >
          <input value={url} onChange={e => setUrl(e.target.value)}
            placeholder={type === 'ntfy' ? 'https://ntfy.sh/my-topic' : 'https://gotify.example.com'}
            className={inputCls} />
        </Field>
      )}

      <div className="flex justify-end">
        <SaveButton onClick={save} saving={saving} saved={saved} />
      </div>
    </div>
  )
}

// ── Modal shell ───────────────────────────────────────────────────────────────
export function SettingsModal({ onClose }) {
  const { state } = useApp()
  const [tab, setTab] = useState('calendars')

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-td-bg2 dark:bg-tn-bg2 rounded-2xl
        border border-td-border dark:border-tn-border shadow-2xl flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-td-border/50 dark:border-tn-border/50 shrink-0">
          <h2 className="font-semibold text-td-fg dark:text-tn-fg text-base">Settings</h2>
          <button onClick={onClose} className="text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3 shrink-0">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${tab === id
                  ? 'bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg'
                  : 'text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg'}`}>
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-5 py-4">
          {tab === 'calendars'     && <CalendarsTab gcalEnabled={state.gcalEnabled} />}
          {tab === 'integrations'  && <IntegrationsTab />}
          {tab === 'notifications' && <NotificationsTab />}
        </div>
      </div>
    </div>
  )
}
