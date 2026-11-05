import { collection, onSnapshot } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../firebase.js'
import { useFreshTeams } from '../lib/fresh.js'
import { deleteTeam, resetAllTeams, resetMyGame, resetTeam } from '../lib/game.js'
import { useAction } from '../lib/hooks.js'
import { secretsSummary } from '../lib/secrets.js'
import Feedback from './Feedback.jsx'
import HostsSection from './HostsSection.jsx'
import Modal from './Modal.jsx'
import TeamDetails from './TeamDetails.jsx'

export default function AdminPanel({ uid }) {
  const freshest = useFreshTeams()
  const [teams, setTeams] = useState([])
  const [confirm, setConfirm] = useState(null) // 'mine' | 'all' | team object
  const [expanded, setExpanded] = useState(null) // team id
  const [deleting, setDeleting] = useState(null) // team object awaiting delete confirmation
  const { busy, msg, setMsg, run } = useAction()
  const summary = secretsSummary()

  useEffect(
    () => onSnapshot(collection(db, 'teams'), (snap) =>
      setTeams(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.credit - a.credit))),
    [],
  )

  function doReset() {
    const which = confirm
    run(async () => {
      if (which === 'mine') {
        await resetMyGame(uid)
        setMsg({ kind: 'ok', text: 'Your game is reset: 100 fc, nothing bought or solved.' })
      } else if (typeof which === 'object') {
        await resetTeam(which.id)
        setMsg({ kind: 'ok', text: `${which.teamName} is reset to 100 fc.` })
      } else {
        const n = await resetAllTeams()
        setMsg({ kind: 'ok', text: `All ${n} teams are reset to 100 fc.` })
      }
      setConfirm(null)
    })
  }

  return (
    <div className="admin">
      <div className="panel">
        <h2>Reset</h2>
        <p>Resets credit to 100 fc, hides all quiz cards, clears post 1 (guesses, hints, time) and deletes the log.</p>
        <Feedback msg={!confirm ? msg : null} />
        <div className="row buttons">
          <button className="btn primary" onClick={() => setConfirm('mine')} disabled={busy}>Reset my game</button>
          <button className="btn danger" onClick={() => setConfirm('all')} disabled={busy}>Reset all teams</button>
        </div>
      </div>

      <HostsSection />

      <div className="panel">
        <h2>Loaded from Secrets</h2>
        <p className="muted">
          What this build of the app contains. On localhost (npm run dev) it reloads automatically when you save a
          file in Secrets. The live site only changes after <code>npm run deploy</code>.
        </p>
        <table className="table">
          <tbody>
            <tr><td>Post 1 accepted answers</td><Status ok={summary.post1Answers > 0}>{summary.post1Answers}</Status></tr>
            <tr><td>Post 1 hints</td><Status ok={summary.hints > 0}>{summary.hints}</Status></tr>
          </tbody>
        </table>
        <table className="table">
          <thead><tr><th>Card</th><th>Price</th><th>Text</th><th>Answer</th><th>Type</th></tr></thead>
          <tbody>
            {summary.quiz.map((q) => (
              <tr key={q.id}>
                <td>{q.id}</td>
                <td>{q.price} fc</td>
                <Status ok={q.hasText}>{q.hasText ? 'ok' : 'missing'}</Status>
                <Status ok={q.hasAnswer}>{q.hasAnswer ? 'ok' : 'missing'}</Status>
                <td>{q.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h2>Teams ({teams.length})</h2>
        <p className="muted">Click a team to see its progress per post.</p>
        <div className="team-list">
          {teams.map((raw) => {
            const t = { ...freshest(raw.id, raw), id: raw.id }
            const open = expanded === t.id
            return (
              <div key={t.id} className={`team-row ${open ? 'open' : ''}`}>
                <div className="team-row-top">
                  <button className="team-row-head" onClick={() => setExpanded(open ? null : t.id)} aria-expanded={open}>
                    <span className="chevron">{open ? '▾' : '▸'}</span>
                    <span className="team-row-name">{t.teamName}</span>
                    <span className="muted">{t.email}</span>
                    <strong className="team-row-credit">{t.credit} fc</strong>
                  </button>
                  <button className="btn small delete" onClick={() => { setMsg(null); setDeleting(t) }} disabled={busy}
                    aria-label={`Remove team ${t.teamName}`}>
                    Remove team
                  </button>
                </div>
                {open && (
                  <>
                    <TeamDetails team={t} />
                    <div className="row team-actions">
                      <button className="btn small danger" onClick={() => setConfirm(t)} disabled={busy}>Reset this team</button>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {confirm && (
        <Modal onClose={() => setConfirm(null)}>
          <h2>
            {confirm === 'mine' ? 'Reset your game?' : confirm === 'all' ? `Reset ALL ${teams.length} teams?` : `Reset ${confirm.teamName}?`}
          </h2>
          <p>
            {confirm === 'all'
              ? 'Every team goes back to 100 fc and all progress is deleted. Team names and accounts are kept. This cannot be undone.'
              : 'The team goes back to 100 fc and all its progress is deleted. The team name is kept.'}
          </p>
          <p className="muted">Only game data is reset: admin rights, host accounts and all logins stay unchanged.</p>
          <Feedback msg={msg} />
          <div className="row buttons">
            <button className={`btn ${confirm === 'mine' ? 'primary' : 'danger'}`} onClick={doReset} disabled={busy}>Yes, reset</button>
            <button className="btn" onClick={() => setConfirm(null)} disabled={busy}>Cancel</button>
          </div>
        </Modal>
      )}

      {deleting && (
        <DeleteTeamModal
          team={deleting}
          isSelf={deleting.id === uid}
          busy={busy}
          msg={msg}
          onCancel={() => setDeleting(null)}
          onDelete={() =>
            run(async () => {
              await deleteTeam(deleting.id)
              setMsg({ kind: 'ok', text: `${deleting.teamName} was removed.` })
              setExpanded(null)
              setDeleting(null)
            })}
        />
      )}
    </div>
  )
}

/** Removing needs the team name typed in, so it cannot happen by a mis-click. */
function DeleteTeamModal({ team, isSelf, busy, msg, onCancel, onDelete }) {
  const [typed, setTyped] = useState('')
  const matches = typed.trim() === team.teamName

  return (
    <Modal onClose={onCancel}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (matches) onDelete()
        }}
      >
        <h2>Are you sure you want to remove {team.teamName}?</h2>
        <p>
          The team, its credit ({team.credit} fc) and all its progress are <strong>permanently deleted</strong>. This
          cannot be undone.
        </p>
        <p className="muted">
          The login {team.email} still exists. If it logs in again it is asked for a new team name and starts at
          100 fc. To remove the login too, delete it in the Firebase console under Authentication → Users.
          {isSelf && ' This is your own team - you will be asked for a new team name right away. Your admin rights are kept.'}
        </p>
        <label>
          <span>Type the team name <strong>{team.teamName}</strong> to confirm</span>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus autoComplete="off" />
        </label>
        <Feedback msg={msg} />
        <div className="row buttons">
          <button className="btn delete" disabled={busy || !matches}>Yes, remove team</button>
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
        </div>
      </form>
    </Modal>
  )
}

function Status({ ok, children }) {
  return <td className={ok ? 'status-ok' : 'status-bad'}>{children}</td>
}
