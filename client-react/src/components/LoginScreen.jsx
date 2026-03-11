import { useState } from 'react'
import { api } from '../api'

export function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e?.preventDefault()
    if (!username || !password) return
    setLoading(true); setError('')
    try {
      const result = await api.login(username, password, remember)
      if (result?.success) {
        onLogin()
      } else {
        setError('Invalid username or password')
      }
    } catch {
      setError('Login failed')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-tn-bg flex items-center justify-center p-4">
      <div className="w-full max-w-xs">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">✓</div>
          <h1 className="text-tn-fg font-bold text-2xl tracking-tight">TD</h1>
          <p className="text-tn-muted text-sm mt-1">Task manager</p>
        </div>

        <form onSubmit={submit} className="bg-tn-bg2 rounded-2xl p-6 border border-tn-border/50 space-y-3">
          {error && (
            <div className="text-tn-red text-xs text-center bg-tn-red/10 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <input
            autoFocus
            type="text" value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Username"
            className="w-full bg-tn-surface text-tn-fg placeholder-tn-muted/50 text-sm rounded-xl px-4 py-3 outline-none border border-tn-border/50 focus:border-tn-blue transition-colors"
          />
          <input
            type="password" value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full bg-tn-surface text-tn-fg placeholder-tn-muted/50 text-sm rounded-xl px-4 py-3 outline-none border border-tn-border/50 focus:border-tn-blue transition-colors"
          />
          <label className="flex items-center gap-2 text-sm text-tn-muted cursor-pointer">
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
              className="accent-blue-500" />
            Remember me
          </label>
          <button
            type="submit"
            disabled={!username || !password || loading}
            className="w-full bg-tn-blue text-tn-bg2 font-semibold py-3 rounded-xl text-sm
              disabled:opacity-40 transition-opacity mt-1"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
