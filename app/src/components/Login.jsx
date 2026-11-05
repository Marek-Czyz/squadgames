import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { useState } from 'react'
import logo from '../assets/logo.png'
import { allowSignup, auth } from '../firebase.js'
import Modal from './Modal.jsx'
import Scoreboard from './Scoreboard.jsx'

const MESSAGES = {
  'auth/invalid-credential': 'Wrong e-mail or password.',
  'auth/invalid-email': 'That e-mail address does not look right.',
  'auth/email-already-in-use': 'An account with this e-mail already exists - log in instead.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts - wait a moment and try again.',
}

/**
 * Public landing page: everyone sees the scoreboard without logging in.
 * Only the team leader (and admin / hosts) log in, via the discreet button in the corner.
 */
export default function Login() {
  const [open, setOpen] = useState(false)

  return (
    <div className="screen landing">
      <button className="leader-login" onClick={() => setOpen(true)}>Leader login</button>
      <main className="landing-main">
        <img src={logo} alt="The Squad Games" className="logo hero" />
        <Scoreboard />
      </main>
      {open && <LeaderLogin onClose={() => setOpen(false)} />}
    </div>
  )
}

function LeaderLogin({ onClose }) {
  const [mode, setMode] = useState(allowSignup ? 'signup' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const fn = mode === 'login' ? signInWithEmailAndPassword : createUserWithEmailAndPassword
      await fn(auth, email.trim(), password)
    } catch (err) {
      setError(MESSAGES[err.code] || err.message)
      setBusy(false)
    }
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={submit}>
        <h2>{mode === 'login' ? 'Log in' : 'Create team account'}</h2>
        {mode === 'signup' && (
          <p className="muted">
            One account per team - the team leader creates it. Everyone else can follow the scoreboard without logging in.
          </p>
        )}
        <label>
          E-mail
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="msg error">{error}</p>}
        <button className="btn primary" disabled={busy}>
          {mode === 'login' ? 'Log in' : 'Create account'}
        </button>
        {allowSignup && (
          <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}>
            {mode === 'login' ? 'New team? Create a team account' : 'Already have an account? Log in'}
          </button>
        )}
      </form>
    </Modal>
  )
}
