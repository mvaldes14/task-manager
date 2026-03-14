import { useState, useEffect, useRef } from 'react'
import { X, Plus, Trash2, Link, Upload, CalendarDays } from 'lucide-react'
import { api } from '../../api'

const COLORS = ['#bb9af7','#7aa2f7','#9ece6a','#f7768e','#ff9e64','#e0af68','#73daca','#7dcfff']

export function IcsManager({ onClose }) {
  const [calendars, setCalendars] = useState([])
  const [tab, setTab] = useState('url') // url | file
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef()

  const load = () => api.listIcs().then(cals => setCalendars(cals || [])).catch(() => {})

  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    if (tab === 'url' && !url.trim()) { setError('URL is required'); return }
    if (tab === 'file' && !file) { setError('Choose a file'); return }
    setError(null)
    setLoading(true)
    try {
      if (tab === 'url') {
        await api.addIcsUrl(name.trim(), url.trim(), color)
      } else {
        await api.addIcsFile(name.trim(), color, file)
      }
      setName(''); setUrl(''); setFile(null)
      await load()
    } catch (e) {
      setError(e.message || 'Failed to import calendar')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    await api.deleteIcs(id)
    await load()
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-td-bg2 dark:bg-tn-bg2 rounded-t-2xl sm:rounded-2xl
        border border-td-border dark:border-tn-border shadow-2xl flex flex-col max-h-[85vh]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-td-border/50 dark:border-tn-border/50 shrink-0">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-td-purple dark:text-tn-purple" />
            <span className="font-semibold text-td-fg dark:text-tn-fg text-sm">ICS Calendars</span>
          </div>
          <button onClick={onClose} className="text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-5">
          {/* Existing calendars */}
          {calendars.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold tracking-widest text-td-muted/60 dark:text-tn-muted/60 uppercase">Imported</p>
              {calendars.map(cal => (
                <div key={cal.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-td-surface/50 dark:bg-tn-surface/50">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: cal.color }} />
                  <span className="flex-1 text-sm text-td-fg dark:text-tn-fg font-medium truncate">{cal.name}</span>
                  {cal.url && <Link size={11} className="text-td-muted/50 dark:text-tn-muted/50 shrink-0" />}
                  <button
                    onClick={() => handleDelete(cal.id)}
                    className="text-td-muted/40 dark:text-tn-muted/40 hover:text-td-red dark:hover:text-tn-red transition-colors shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add new */}
          <div className="space-y-3">
            <p className="text-[10px] font-semibold tracking-widest text-td-muted/60 dark:text-tn-muted/60 uppercase">Add Calendar</p>

            {/* Tab toggle */}
            <div className="flex bg-td-surface dark:bg-tn-surface rounded-lg p-0.5">
              {['url','file'].map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors
                    ${tab === t ? 'bg-td-bg2 dark:bg-tn-bg2 text-td-fg dark:text-tn-fg shadow-sm' : 'text-td-muted dark:text-tn-muted'}`}>
                  {t === 'url' ? <><Link size={11} /> URL</> : <><Upload size={11} /> File</>}
                </button>
              ))}
            </div>

            {/* Name */}
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Calendar name"
              className="w-full px-3 py-2.5 rounded-xl text-sm bg-td-surface dark:bg-tn-surface
                text-td-fg dark:text-tn-fg placeholder:text-td-muted/50 dark:placeholder:text-tn-muted/50
                border border-transparent focus:border-td-blue/50 dark:focus:border-tn-blue/50 outline-none transition-colors"
            />

            {/* URL or file */}
            {tab === 'url' ? (
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://calendar.example.com/feed.ics"
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-td-surface dark:bg-tn-surface
                  text-td-fg dark:text-tn-fg placeholder:text-td-muted/50 dark:placeholder:text-tn-muted/50
                  border border-transparent focus:border-td-blue/50 dark:focus:border-tn-blue/50 outline-none transition-colors"
              />
            ) : (
              <div>
                <input ref={fileRef} type="file" accept=".ics" className="hidden"
                  onChange={e => setFile(e.target.files[0] || null)} />
                <button onClick={() => fileRef.current.click()}
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-td-surface dark:bg-tn-surface
                    text-td-muted dark:text-tn-muted border border-dashed border-td-border dark:border-tn-border
                    hover:border-td-blue/50 dark:hover:border-tn-blue/50 transition-colors text-left">
                  {file ? file.name : 'Choose .ics file…'}
                </button>
              </div>
            )}

            {/* Color picker */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-td-muted dark:text-tn-muted shrink-0">Color</span>
              <div className="flex gap-1.5 flex-wrap">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setColor(c)}
                    className={`w-5 h-5 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-offset-td-bg2 dark:ring-offset-tn-bg2 ring-white/70 scale-110' : 'hover:scale-105'}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>

            {error && <p className="text-xs text-td-red dark:text-tn-red">{error}</p>}

            <button
              onClick={handleAdd}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium
                bg-td-blue/10 dark:bg-tn-blue/10 text-td-blue dark:text-tn-blue
                hover:bg-td-blue/20 dark:hover:bg-tn-blue/20 transition-colors disabled:opacity-50"
            >
              {loading ? 'Importing…' : <><Plus size={14} /> Import Calendar</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
