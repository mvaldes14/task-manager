import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, CalendarDays, Puzzle, Bell, Link, Upload, Trash2, Plus, CheckCircle2, RefreshCw, UserCircle, Users } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { api } from '../../api'

const TABS = [
  { id: 'account',       label: 'Account',       icon: UserCircle },
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

// ── Account tab ───────────────────────────────────────────────────────────────
function AccountTab() {
  const { state, dispatch } = useApp()
  const user = state.currentUser
  const fileRef = useRef()
  const [displayName, setDisplayName] = useState(user?.display_name || '')
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [pwError, setPwError] = useState('')
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [avatarFile, setAvatarFile] = useState(null)
  const [newUsername, setNewUsername] = useState('')
  const [newUserPw, setNewUserPw] = useState('')
  const [addingUser, setAddingUser] = useState(false)
  const [addUserError, setAddUserError] = useState('')

  const saveProfile = async () => {
    setSaving(true); setSaved(false)
    try {
      const updated = await api.updateMe({ display_name: displayName.trim() || null })
      dispatch({ type: 'SET_CURRENT_USER', payload: updated })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally { setSaving(false) }
  }

  const savePassword = async () => {
    setPwError('')
    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return }
    if (newPw.length < 6)    { setPwError('Password must be at least 6 characters'); return }
    setSaving(true)
    try {
      await api.updateMe({ current_password: currentPw, new_password: newPw })
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setPwError(e.message || 'Failed to change password')
    } finally { setSaving(false) }
  }

  const handleAvatarChange = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setAvatarFile(f)
    const reader = new FileReader()
    reader.onload = ev => setAvatarPreview(ev.target.result)
    reader.readAsDataURL(f)
  }

  const uploadAvatar = async () => {
    if (!avatarFile) return
    setSaving(true)
    try {
      await api.uploadAvatar(avatarFile)
      const updated = await api.getMe()
      dispatch({ type: 'SET_CURRENT_USER', payload: updated })
      setAvatarFile(null); setAvatarPreview(null)
    } catch (e) {
      setPwError(e.message || 'Upload failed')
    } finally { setSaving(false) }
  }

  const addUser = async () => {
    setAddUserError('')
    if (!newUsername.trim() || !newUserPw.trim()) { setAddUserError('Username and password required'); return }
    setAddingUser(true)
    try {
      const created = await api.createUser({ username: newUsername.trim(), password: newUserPw.trim() })
      const users = await api.getUsers()
      if (users) dispatch({ type: 'SET_USERS', payload: users })
      setNewUsername(''); setNewUserPw('')
    } catch (e) {
      setAddUserError(e.message || 'Failed to create user')
    } finally { setAddingUser(false) }
  }

  if (!user) return (
    <div className="flex items-center justify-center py-12 text-td-muted dark:text-tn-muted text-sm">
      Loading account…
    </div>
  )

  const avatarSrc = avatarPreview || (user.has_avatar ? api.getUserAvatarUrl(user.id) : null)

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          {avatarSrc
            ? <img src={avatarSrc} alt="" className="w-14 h-14 rounded-full object-cover" />
            : (
              <div className="w-14 h-14 rounded-full bg-td-blue dark:bg-tn-blue flex items-center justify-center text-white text-xl font-bold select-none">
                {(user.display_name || user.username || '?')[0].toUpperCase()}
              </div>
            )
          }
        </div>
        <div className="flex-1 space-y-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          <button onClick={() => fileRef.current.click()}
            className={`${inputCls} text-left text-td-muted dark:text-tn-muted border-dashed border border-td-border dark:border-tn-border`}>
            {avatarFile ? avatarFile.name : 'Choose photo…'}
          </button>
          {avatarFile && (
            <button onClick={uploadAvatar} disabled={saving}
              className="w-full py-2 rounded-xl text-sm font-medium bg-td-blue/10 dark:bg-tn-blue/10 text-td-blue dark:text-tn-blue hover:bg-td-blue/20 dark:hover:bg-tn-blue/20 transition-colors disabled:opacity-50">
              Upload avatar
            </button>
          )}
        </div>
      </div>

      {/* Display name */}
      <Field label="Display name">
        <div className="flex gap-2">
          <input value={displayName} onChange={e => setDisplayName(e.target.value)}
            placeholder={user.username} className={inputCls} />
          <SaveButton onClick={saveProfile} saving={saving} saved={saved} />
        </div>
      </Field>

      {/* Change password */}
      <div className="border-t border-td-border/30 dark:border-tn-border/30 pt-4 space-y-3">
        <p className={labelCls}>Change password</p>
        <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)}
          placeholder="Current password" className={inputCls} />
        <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
          placeholder="New password" className={inputCls} />
        <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
          placeholder="Confirm new password" className={inputCls} />
        {pwError && <p className="text-xs text-td-red dark:text-tn-red">{pwError}</p>}
        <div className="flex justify-end">
          <SaveButton onClick={savePassword} saving={saving} saved={saved} />
        </div>
      </div>

      {/* Team members (admin only) */}
      {user.is_admin && (
        <div className="border-t border-td-border/30 dark:border-tn-border/30 pt-4 space-y-3">
          <p className={labelCls}>Team members</p>
          {state.users.map(u => (
            <div key={u.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-td-surface/50 dark:bg-tn-surface/50">
              <div className="w-7 h-7 rounded-full bg-td-blue/20 dark:bg-tn-blue/20 flex items-center justify-center text-xs font-bold text-td-blue dark:text-tn-blue shrink-0">
                {(u.display_name || u.username)[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-td-fg dark:text-tn-fg truncate">{u.display_name || u.username}</p>
                {u.display_name && <p className="text-[11px] text-td-muted dark:text-tn-muted">{u.username}</p>}
              </div>
              {u.is_admin && <span className="text-[10px] px-1.5 py-0.5 rounded bg-td-blue/10 dark:bg-tn-blue/10 text-td-blue dark:text-tn-blue font-semibold">admin</span>}
            </div>
          ))}
          <div className="pt-1 space-y-2">
            <p className={labelCls}>Add member</p>
            <input value={newUsername} onChange={e => setNewUsername(e.target.value)}
              placeholder="Username" className={inputCls} />
            <input type="password" value={newUserPw} onChange={e => setNewUserPw(e.target.value)}
              placeholder="Password" className={inputCls} />
            {addUserError && <p className="text-xs text-td-red dark:text-tn-red">{addUserError}</p>}
            <button onClick={addUser} disabled={addingUser}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium
                bg-td-blue/10 dark:bg-tn-blue/10 text-td-blue dark:text-tn-blue
                hover:bg-td-blue/20 dark:hover:bg-tn-blue/20 transition-colors disabled:opacity-50">
              {addingUser ? 'Adding…' : <><Plus size={14} /> Add member</>}
            </button>
          </div>
        </div>
      )}
    </div>
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
  const [otel, setOtel] = useState('')
  const [aiWebhook, setAiWebhook] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.getSettings().then(s => {
      if (!s) return
      setOtel(s.otel_frontend_endpoint || '')
      setAiWebhook(s.ai_webhook_url || '')
    }).catch(() => {})
  }, [])

  const save = async () => {
    setSaving(true); setSaved(false)
    try {
      const updated = await api.updateSettings({
        otel_frontend_endpoint: otel.trim() || null,
        ai_webhook_url: aiWebhook.trim() || null,
      })
      if (updated) dispatch({ type: 'SET_SETTINGS', payload: updated })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <p className={labelCls}>AI Webhook</p>
        <Field
          label="Webhook URL"
          hint="Tasks tagged @ai are POST'd here as JSON. Works with n8n, Make, Zapier, etc."
        >
          <input
            value={aiWebhook}
            onChange={e => setAiWebhook(e.target.value)}
            placeholder="https://n8n.example.com/webhook/..."
            className={inputCls}
          />
        </Field>
      </div>

      <div className="border-t border-td-border/30 dark:border-tn-border/30 pt-5 space-y-4">
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
const TIMEZONES = [
  ['America/New_York',    'Eastern (ET)'],
  ['America/Chicago',     'Central (CT)'],
  ['America/Denver',      'Mountain (MT)'],
  ['America/Phoenix',     'Mountain — no DST (AZ)'],
  ['America/Los_Angeles', 'Pacific (PT)'],
  ['America/Anchorage',   'Alaska (AKT)'],
  ['Pacific/Honolulu',    'Hawaii (HST)'],
  ['Europe/London',       'London (GMT/BST)'],
  ['Europe/Paris',        'Paris (CET/CEST)'],
  ['Europe/Berlin',       'Berlin (CET/CEST)'],
  ['Asia/Tokyo',          'Tokyo (JST)'],
  ['Asia/Shanghai',       'Shanghai (CST)'],
  ['Asia/Kolkata',        'India (IST)'],
  ['Australia/Sydney',    'Sydney (AEST)'],
  ['UTC',                 'UTC'],
]

function NotificationsTab() {
  const [type, setType] = useState('')
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')
  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [minutesBefore, setMinutesBefore] = useState(30)
  const [allDayTime, setAllDayTime] = useState('08:00')
  const [tz, setTz] = useState('America/Chicago')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.getSettings().then(s => {
      if (!s) return
      setType(s.notification_type || '')
      setUrl(s.notification_url || '')
      setToken(s.notification_token || '')
      setReminderEnabled(!!s.reminder_enabled)
      setMinutesBefore(s.reminder_minutes_before ?? 30)
      setAllDayTime(s.reminder_allday_time || '08:00')
      setTz(s.reminder_timezone || 'America/Chicago')
    }).catch(() => {})
  }, [])

  const save = async () => {
    setSaving(true); setSaved(false)
    try {
      await api.updateSettings({
        notification_type:        type || null,
        notification_url:         url.trim() || null,
        notification_token:       token.trim() || null,
        reminder_enabled:         reminderEnabled,
        reminder_minutes_before:  Number(minutesBefore),
        reminder_allday_time:     allDayTime,
        reminder_timezone:        tz,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-5">
      {/* Service selector */}
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
        <>
          <Field
            label={type === 'ntfy' ? 'ntfy topic URL' : 'Gotify server URL'}
            hint={type === 'ntfy' ? 'e.g. https://ntfy.sh/my-topic' : 'e.g. https://gotify.example.com'}
          >
            <input value={url} onChange={e => setUrl(e.target.value)}
              placeholder={type === 'ntfy' ? 'https://ntfy.sh/my-topic' : 'https://gotify.example.com'}
              className={inputCls} />
          </Field>

          <Field
            label={type === 'gotify' ? 'App token' : 'Auth token (optional)'}
            hint={type === 'gotify' ? 'Token from your Gotify app' : 'Leave empty for public ntfy topics'}
          >
            <input type="password" value={token} onChange={e => setToken(e.target.value)}
              placeholder={type === 'gotify' ? 'xxxxxxxxxxxxxxx' : 'Bearer token (optional)'}
              className={inputCls} />
          </Field>
        </>
      )}

      {/* Reminders section */}
      <div className="border-t border-td-border/30 dark:border-tn-border/30 pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-td-fg dark:text-tn-fg">Reminders</p>
            <p className="text-[11px] text-td-muted dark:text-tn-muted mt-0.5">Send a notification before tasks are due</p>
          </div>
          <button
            onClick={() => setReminderEnabled(v => !v)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent
              transition-colors duration-200 focus:outline-none
              ${reminderEnabled ? 'bg-td-blue dark:bg-tn-blue' : 'bg-td-border dark:bg-tn-border'}`}
          >
            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow
              transition duration-200 ${reminderEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
        </div>

        {reminderEnabled && (
          <div className="space-y-3 pl-0.5">
            <Field label="Timezone">
              <select value={tz} onChange={e => setTz(e.target.value)} className={inputCls}>
                {TIMEZONES.map(([val, lbl]) => (
                  <option key={val} value={val}>{lbl}</option>
                ))}
              </select>
            </Field>

            <Field label="Remind before due time (timed tasks)" hint="Minutes before the task's due time to send the notification">
              <div className="flex items-center gap-2">
                <input
                  type="number" min="0" max="1440"
                  value={minutesBefore}
                  onChange={e => setMinutesBefore(e.target.value)}
                  className={`${inputCls} w-24`}
                />
                <span className="text-xs text-td-muted dark:text-tn-muted shrink-0">minutes before</span>
              </div>
            </Field>

            <Field label="All-day task reminder time" hint="Time to send reminders for tasks with a due date but no specific time">
              <input
                type="time"
                value={allDayTime}
                onChange={e => setAllDayTime(e.target.value)}
                className={`${inputCls} w-36`}
              />
            </Field>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <SaveButton onClick={save} saving={saving} saved={saved} />
      </div>
    </div>
  )
}

// ── Modal shell ───────────────────────────────────────────────────────────────
export function SettingsModal({ onClose }) {
  const { state } = useApp()
  const [tab, setTab] = useState('account')

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-lg bg-td-bg2 dark:bg-tn-bg2 rounded-2xl
            border border-td-border dark:border-tn-border shadow-2xl flex flex-col max-h-[88vh] overflow-hidden"
          style={{ animation: 'slideUp 0.18s ease-out' }}
        >

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-td-border/50 dark:border-tn-border/50 shrink-0">
          <h2 className="font-semibold text-td-fg dark:text-tn-fg text-base">Settings</h2>
          <button onClick={onClose} className="text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3 shrink-0 overflow-x-auto pb-0.5">
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
          {tab === 'account'       && <AccountTab />}
          {tab === 'calendars'     && <CalendarsTab gcalEnabled={state.gcalEnabled} />}
          {tab === 'integrations'  && <IntegrationsTab />}
          {tab === 'notifications' && <NotificationsTab />}
        </div>
      </div>
    </div>

    <style>{`
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(12px) scale(0.97); }
        to   { opacity: 1; transform: translateY(0)    scale(1); }
      }
    `}</style>
  </>,
  document.body
  )
}
