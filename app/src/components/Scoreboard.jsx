import { collection, onSnapshot } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../firebase.js'

/** Public, live scoreboard (readable without logging in). */
export default function Scoreboard({ highlightUid }) {
  const [rows, setRows] = useState(null)

  useEffect(
    () => onSnapshot(
      collection(db, 'scoreboard'),
      (snap) => setRows(snap.docs
        .map((d) => ({ uid: d.id, ...d.data() }))
        .filter((r) => r.teamName)
        .sort((a, b) => b.credit - a.credit || a.teamName.localeCompare(b.teamName))),
      () => setRows([]),
    ),
    [],
  )

  return (
    <section className="panel scoreboard">
      <h2>Scoreboard</h2>
      {rows === null ? (
        <p className="muted">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="muted">No teams yet.</p>
      ) : (
        <table className="table">
          <thead><tr><th>#</th><th>Team</th><th className="num">Score</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.uid} className={r.uid === highlightUid ? 'me' : ''}>
                <td className="rank">{i + 1}</td>
                <td>{r.teamName}</td>
                <td className="num"><strong>{r.credit}</strong> fc</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
