import { signOut } from 'firebase/auth'
import { useState } from 'react'
import logo from '../assets/logo.png'
import { auth } from '../firebase.js'
import { createTeam, START_CREDIT } from '../lib/game.js'

export default function TeamSetup({ user }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await createTeam(user, name)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="screen center login-screen">
      <form className="panel narrow" onSubmit={submit}>
        <img src={logo} alt="The Squad Games" className="logo big" />
        <h1>Welcome, new team!</h1>
        <p>Choose your team name. Every team starts with <strong>{START_CREDIT} fc</strong> (flex-coins).</p>
        <label>
          Team name
          <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoFocus required />
        </label>
        {error && <p className="msg error">{error}</p>}
        <button className="btn primary" disabled={busy}>Start the game</button>
        <button type="button" className="link" onClick={() => signOut(auth)}>Log out</button>
      </form>
    </div>
  )
}
