import { collection, onSnapshot } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../firebase.js'
import { useFreshTeams } from '../lib/fresh.js'
import { GameError, HOST_POSTS, hostAward, hostTotal } from '../lib/game.js'
import { POSTS } from '../posts.js'
import Feedback from './Feedback.jsx'

const signed = (n) => `${n > 0 ? '+' : ''}${n}`

/** Hosts (and admins): award fc to every team at posts 2, 4 and 5. */
export default function HostPanel() {
  const freshest = useFreshTeams()
  const [teams, setTeams] = useState(null)
  const [postId, setPostId] = useState(2)
  const [pending, setPending] = useState(null) // team id with a write in flight
  const [msg, setMsg] = useState(null)
  const post = POSTS.find((p) => p.id === postId)
  const { step, min, max } = HOST_POSTS[postId]

  useEffect(
    () => onSnapshot(collection(db, 'teams'), (snap) =>
      setTeams(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.teamName.localeCompare(b.teamName)))),
    [],
  )

  async function award(team, delta) {
    setPending(team.id)
    setMsg(null)
    try {
      await hostAward(team.id, postId, delta)
    } catch (err) {
      setMsg({ kind: 'error', text: err instanceof GameError ? err.message : `Something went wrong: ${err.message}` })
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="host-panel">
      <div className="tabs" role="tablist">
        {Object.keys(HOST_POSTS).map(Number).map((id) => {
          const p = POSTS.find((x) => x.id === id)
          return (
            <button key={id} role="tab" aria-selected={id === postId} className={`tab ${id === postId ? 'active' : ''}`}
              style={{ '--accent': p.accent }} onClick={() => { setPostId(id); setMsg(null) }}>
              <span className="badge small">{id}</span> {p.title}
            </button>
          )
        })}
      </div>

      <div className="panel">
        <p className="muted">
          {signed(step)} / {signed(-step)} fc per press · allowed per team at this post:{' '}
          {min === null ? `up to ${signed(max)} fc (no lower limit)` : `${min} to ${max} fc`}
          {postId === 5 && ' · give the winner +5 and the loser -5 for each round'}
        </p>
        <Feedback msg={msg} />
        {teams === null ? (
          <p className="muted">Loading teams...</p>
        ) : teams.length === 0 ? (
          <p className="muted">No teams registered yet.</p>
        ) : (
          <table className="table host-table">
            <thead><tr><th>Team</th><th className="num">{post.title}</th><th className="num">Score</th><th /></tr></thead>
            <tbody>
              {teams.map((raw) => {
                const t = { ...freshest(raw.id, raw), id: raw.id }
                const total = hostTotal(t, postId)
                const busy = pending === t.id
                return (
                  <tr key={t.id}>
                    <td className="team-row-name">{t.teamName}</td>
                    <td className="num"><strong>{signed(total)} fc</strong></td>
                    <td className="num">{t.credit} fc</td>
                    <td className="host-buttons">
                      <button className="btn danger" onClick={() => award(t, -step)} disabled={busy || (min !== null && total - step < min)}
                        aria-label={`${-step} fc for ${t.teamName}`}>
                        {signed(-step)}fc
                      </button>
                      <button className="btn ok" onClick={() => award(t, step)} disabled={busy || total + step > max}
                        aria-label={`+${step} fc for ${t.teamName}`}>
                        {signed(step)}fc
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
