import { collection, onSnapshot } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../firebase.js'
import { addHost, removeHost } from '../lib/game.js'
import { useAction } from '../lib/hooks.js'
import Feedback from './Feedback.jsx'
import Modal from './Modal.jsx'

const AUTH_MESSAGES = {
  'auth/email-already-in-use': 'An account with this e-mail already exists. Use another e-mail for the host.',
  'auth/invalid-email': 'That e-mail address does not look right.',
  'auth/weak-password': 'Password must be at least 6 characters.',
}

/** Admin: create host logins (no team) and remove the host role again. */
export default function HostsSection() {
  const [hosts, setHosts] = useState([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [removing, setRemoving] = useState(null)
  const { busy, msg, setMsg, run } = useAction()

  useEffect(
    () => onSnapshot(collection(db, 'hosts'), (snap) =>
      setHosts(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.email.localeCompare(b.email)))),
    [],
  )

  function submit(e) {
    e.preventDefault()
    run(async () => {
      try {
        await addHost(email, password)
      } catch (err) {
        if (AUTH_MESSAGES[err.code]) return setMsg({ kind: 'error', text: AUTH_MESSAGES[err.code] })
        throw err
      }
      setMsg({ kind: 'ok', text: `Host ${email.trim()} created. Give them the e-mail and password to log in.` })
      setEmail('')
      setPassword('')
    })
  }

  return (
    <div className="panel">
      <h2>Hosts</h2>
      <p className="muted">
        Hosts run posts 2, 4 and 5: after logging in they only see the list of teams with +/- buttons. No team is
        created for a host account.
      </p>
      {hosts.length > 0 && (
        <table className="table">
          <tbody>
            {hosts.map((h) => (
              <tr key={h.id}>
                <td>{h.email}</td>
                <td className="num">
                  <button className="btn small" onClick={() => { setMsg(null); setRemoving(h) }} disabled={busy}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <form className="row host-form" onSubmit={submit}>
        <label className="grow">
          Host e-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" required />
        </label>
        <label className="grow">
          Password (min. 6 characters)
          <input value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={6} required />
        </label>
        <button className="btn primary" disabled={busy || !email || password.length < 6}>Add host</button>
      </form>
      <Feedback msg={!removing ? msg : null} />

      {removing && (
        <Modal onClose={() => setRemoving(null)}>
          <h2>Remove host {removing.email}?</h2>
          <p>
            They can no longer award fc. The login itself remains - delete it in the Firebase console under
            Authentication → Users if needed.
          </p>
          <Feedback msg={msg} />
          <div className="row buttons">
            <button className="btn danger" disabled={busy}
              onClick={() => run(async () => {
                await removeHost(removing.id)
                setMsg({ kind: 'ok', text: `${removing.email} is no longer a host.` })
                setRemoving(null)
              })}>
              Remove host
            </button>
            <button className="btn" onClick={() => setRemoving(null)} disabled={busy}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
