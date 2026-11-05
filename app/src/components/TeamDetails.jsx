import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../firebase.js'
import { hostTotal, judgeRiddle } from '../lib/game.js'
import { useAction } from '../lib/hooks.js'
import { HINT_COUNT, QUIZ } from '../lib/secrets.js'
import Feedback from './Feedback.jsx'
import Modal from './Modal.jsx'

const TYPE_LABEL = {
  'guess-correct': 'Correct guess',
  'guess-wrong': 'Wrong guess',
  'buy-time': 'Bought time',
  'buy-hint': 'Bought hint',
  'host-grant': 'Host grant',
  'reward-claimed': 'Reward code claimed',
  'host-award': 'Host award',
  'buy-quiz': 'Bought card',
  'quiz-correct': 'Correct answer',
  'quiz-wrong': 'Wrong answer',
}

const STATE_LABEL = { hidden: 'hidden', bought: 'bought', solved: 'solved' }
const POST_TITLES = { 2: 'The art of engineering', 4: 'Show it, not tell it', 5: 'Tic-Tac-Run' }

function time(ts) {
  return ts ? ts.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''
}

/** Admin: one team's progress per post, built from the team doc and its log. */
export default function TeamDetails({ team }) {
  const [log, setLog] = useState([])
  const [judging, setJudging] = useState(null) // riddle waiting for the Game Master's verdict
  const { busy, msg, setMsg, run } = useAction()

  useEffect(
    () => onSnapshot(query(collection(db, 'teams', team.id, 'log'), orderBy('at', 'desc')), (snap) =>
      setLog(snap.docs.map((d) => ({ ...d.data({ serverTimestamps: 'estimate' }), key: d.id })))),
    [team.id],
  )

  const p1 = team.post1
  const guesses = log.filter((e) => e.post === 1 && e.type.startsWith('guess'))
  const sum = (entries) => entries.reduce((t, e) => t + e.delta, 0)
  const quizLog = log.filter((e) => e.post === 3)

  const rewardSection = (post) => {
    const total = hostTotal(team, post)
    const awards = log.filter((e) => e.post === post && e.type === 'host-award').length
    return (
      <section>
        <h3>{post} · {POST_TITLES[post]}</h3>
        <p>
          {awards || total
            ? <>From hosts: <strong>{total > 0 ? '+' : ''}{total} fc</strong> <span className="muted">({awards} press{awards === 1 ? '' : 'es'})</span></>
            : <span className="muted">Nothing from hosts yet</span>}
        </p>
      </section>
    )
  }

  function verdict(correct) {
    const q = judging
    run(async () => {
      await judgeRiddle(team.id, q.id, correct)
      setMsg({ kind: 'ok', text: `${q.id}: ${correct ? `correct, +${q.price * 2} fc granted` : 'incorrect, card hidden again'}.` })
      setJudging(null)
    })
  }

  return (
    <div className="team-details">
      <section>
        <h3>1 · What is this? What is what?</h3>
        <p>
          {p1.solved ? <span className="status-ok">Solved</span> : <span className="status-bad">Not solved</span>}
          {' · '}wrong guesses {p1.wrongGuesses} · hints {p1.hintsBought} / {HINT_COUNT} · time bought {p1.timeBought} × 15 s
        </p>
        {guesses.length > 0 && (
          <p className="muted">
            Guesses: {guesses.slice().reverse().map((g) => (
              <span key={g.key} className={g.type === 'guess-correct' ? 'status-ok' : ''}>“{g.guess}” </span>
            ))}
          </p>
        )}
      </section>

      {rewardSection(2)}
      <section>
        <h3>3 · Knowledge is king</h3>
        <p>
          Spent {-sum(quizLog.filter((e) => e.delta < 0))} fc · won {sum(quizLog.filter((e) => e.delta > 0))} fc
        </p>
        <div className="mini-cards">
          {QUIZ.map((q) => {
            const entry = team.quiz[q.id] ?? { state: 'hidden', purchases: 0 }
            const content = (
              <>
                <strong>{q.id}</strong> {STATE_LABEL[entry.state]}
                {entry.purchases > 0 && <small> · bought {entry.purchases}×</small>}
              </>
            )
            // A riddle the team has bet on can be judged by the Game Master
            return q.kind === 'riddle' && entry.state === 'bought' ? (
              <button key={q.id} className="mini-card bought judge" onClick={() => { setMsg(null); setJudging(q) }}
                title="Judge the team's answer">
                {content} · <span className="judge-hint">judge</span>
              </button>
            ) : (
              <span key={q.id} className={`mini-card ${entry.state}`} title={`${q.price} fc`}>{content}</span>
            )
          })}
        </div>
        <Feedback msg={!judging ? msg : null} />
      </section>

      {rewardSection(4)}
      {rewardSection(5)}

      <section>
        <h3>Activity</h3>
        {log.length === 0 ? (
          <p className="muted">Nothing yet.</p>
        ) : (
          <table className="table compact">
            <thead><tr><th>Time</th><th>Post</th><th>What</th><th>Change</th><th>Credit</th></tr></thead>
            <tbody>
              {log.map((e) => (
                <tr key={e.key}>
                  <td>{time(e.at)}</td>
                  <td>{e.post}</td>
                  <td>
                    {TYPE_LABEL[e.type] ?? e.type}
                    {e.id && ` ${e.id}`}
                    {e.answer && <span className="muted"> “{e.answer}”</span>}
                    {e.guess && <span className="muted"> “{e.guess}”</span>}
                    {e.hint && <span className="muted"> #{e.hint}</span>}
                    {e.by && <span className="muted"> by {e.by}</span>}
                  </td>
                  <td className={e.delta > 0 ? 'status-ok' : e.delta < 0 ? 'status-bad' : ''}>
                    {e.delta > 0 ? '+' : ''}{e.delta || ''}
                  </td>
                  <td>{e.creditAfter} fc</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {judging && (
        <Modal onClose={() => setJudging(null)}>
          <p className="eyebrow">{team.teamName} · Riddle {judging.id.slice(1)} · {judging.price} fc</p>
          <h2>Is the team&apos;s answer correct?</h2>
          <p className="muted">Correct pays back {judging.price * 2} fc. Incorrect hides the card again.</p>
          <Feedback msg={msg} />
          <div className="row buttons verdict-buttons">
            <button className="btn ok verdict-btn" onClick={() => verdict(true)} disabled={busy} aria-label="Grant reward">
              ✓<small>Grant reward</small>
            </button>
            <button className="btn danger verdict-btn" onClick={() => verdict(false)} disabled={busy} aria-label="Incorrect">
              ✗<small>Incorrect</small>
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
