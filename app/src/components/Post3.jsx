import { useEffect, useRef, useState } from 'react'
import { answerQuiz, buyQuiz } from '../lib/game.js'
import { useAction } from '../lib/hooks.js'
import { isQuizAnswer, QUIZ, quizItem } from '../lib/secrets.js'
import Feedback from './Feedback.jsx'
import Modal from './Modal.jsx'

// Colour ramps (light -> brand -> deep) for questions (coral) and riddles (blue)
const RAMPS = {
  question: ['#FAD5CE', '#FF695C', '#A8281E'],
  riddle: ['#C8E8FA', '#005BFF', '#00226B'],
}

function mix(a, b, t) {
  const pa = a.match(/\w\w/g).map((h) => parseInt(h, 16))
  const pb = b.match(/\w\w/g).map((h) => parseInt(h, 16))
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`
}

function rampColor(kind, t) {
  const [lo, mid, hi] = RAMPS[kind]
  return t < 0.5 ? mix(lo, mid, t * 2) : mix(mid, hi, (t - 0.5) * 2)
}

/** Card colours by price: cheapest = lightest, most expensive = darkest. */
function cardStyle(q) {
  const prices = QUIZ.filter((x) => x.kind === q.kind).map((x) => x.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const t = max === min ? 0.5 : (q.price - min) / (max - min)
  return {
    background: `linear-gradient(135deg, ${rampColor(q.kind, t * 0.8)}, ${rampColor(q.kind, Math.min(1, t * 0.8 + 0.2))})`,
    color: t > 0.25 ? '#FAFAFA' : '#1A1A1A',
  }
}

export const GAME_MASTER_TEXT =
  'Answer to this riddle is not a number. Tell your answer to the Game Master to grant your reward if correct.'
const isHostRiddle = (q) => q.kind === 'riddle' && q.check === 'host'

const label = (q) => `${q.kind === 'question' ? 'Question' : 'Riddle'} ${q.id.slice(1)}`

export default function Post3({ uid, team }) {
  const [confirm, setConfirm] = useState(null) // card waiting for "buy?" confirmation
  const [openId, setOpenId] = useState(null) // bought card being answered
  const [result, setResult] = useState(null) // { correct, q }
  const { busy, msg, setMsg, run } = useAction()

  // Riddles judged by the Game Master change state from the admin panel: tell the team the verdict
  const prevStates = useRef(null)
  useEffect(() => {
    const prev = prevStates.current
    prevStates.current = Object.fromEntries(QUIZ.map((q) => [q.id, team.quiz[q.id]?.state]))
    if (!prev) return
    const judged = QUIZ.find((q) => isHostRiddle(q) && prev[q.id] === 'bought' && team.quiz[q.id]?.state !== 'bought')
    if (judged) {
      setOpenId((id) => (id === judged.id ? null : id))
      setResult({ correct: team.quiz[judged.id]?.state === 'solved', q: judged })
    }
  }, [team.quiz])

  function onCard(q) {
    const state = team.quiz[q.id]?.state
    setMsg(null)
    if (state === 'hidden') setConfirm(q)
    else if (state === 'bought') setOpenId(q.id)
  }

  function onBuy() {
    const q = confirm
    run(async () => {
      await buyQuiz(uid, q.id)
      setConfirm(null)
      setOpenId(q.id)
    })
  }

  async function onAnswer(q, answer) {
    await run(async () => {
      const correct = await isQuizAnswer(q.id, answer)
      await answerQuiz(uid, q.id, answer, correct)
      setOpenId(null)
      setResult({ correct, q })
    })
  }

  const groups = [
    ['Questions', QUIZ.filter((q) => q.kind === 'question')],
    ['Riddles', QUIZ.filter((q) => q.kind === 'riddle')],
  ]
  const open = QUIZ.find((q) => q.id === openId)

  return (
    <div>
      <p className="intro">
        Buy a question or a riddle to reveal it, then answer it. Correct answer = doubled amount back. You may try
        several times until answered correctly, but you must pay each time.
      </p>
      <Feedback msg={!confirm && !open ? msg : null} />
      {groups.map(([title, items]) => (
        <section key={title} className="quiz-group">
          <h2>{title}</h2>
          <div className="quiz-grid">
            {items.map((q) => {
              const state = team.quiz[q.id]?.state ?? 'hidden'
              return (
                <button
                  key={q.id}
                  className={`quiz-card ${state}`}
                  style={state === 'solved' ? undefined : cardStyle(q)}
                  onClick={() => onCard(q)}
                  disabled={state === 'solved'}
                >
                  <span className="quiz-label">{label(q)}</span>
                  <span className="quiz-mark">{state === 'solved' ? '✓' : state === 'bought' ? '!' : '?'}</span>
                  <span className="quiz-price">
                    {state === 'solved'
                      ? `+${q.price * 2} fc earned`
                      : state === 'bought'
                        ? (isHostRiddle(q) ? 'Waiting for Game Master' : 'Bought - answer it')
                        : `${q.price} fc`}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      ))}

      {confirm && (
        <Modal onClose={() => setConfirm(null)}>
          <h2>Do you really want to buy this?</h2>
          <p>
            {label(confirm)} costs <strong>{confirm.price} fc</strong>. A correct answer pays back{' '}
            <strong>{confirm.price * 2} fc</strong>. Once purchased, there is no way back.
          </p>
          <Feedback msg={msg} />
          <div className="row buttons">
            <button className="btn primary" onClick={onBuy} disabled={busy}>Yes</button>
            <button className="btn" onClick={() => setConfirm(null)} disabled={busy}>No</button>
          </div>
        </Modal>
      )}

      {open && (
        <Modal onClose={() => setOpenId(null)}>
          <AnswerForm
            q={open}
            busy={busy}
            msg={msg}
            onSubmit={(a) => onAnswer(open, a)}
            onClose={() => setOpenId(null)}
          />
        </Modal>
      )}

      {result && (
        <Modal onClose={() => setResult(null)}>
          <h2>{result.correct ? 'Correct!' : 'Wrong answer'}</h2>
          <p>
            {result.correct
              ? `+${result.q.price * 2} fc added to your account.`
              : `The ${result.q.price} fc are gone and the card is hidden again. You may buy it again.`}
          </p>
          <button className="btn primary" onClick={() => setResult(null)}>OK</button>
        </Modal>
      )}
    </div>
  )
}

function AnswerForm({ q, busy, msg, onSubmit, onClose }) {
  const item = quizItem(q.id)
  const [picked, setPicked] = useState([])
  const [text, setText] = useState('')
  const check = item.kind === 'question' ? 'choice' : item.check

  function toggle(key) {
    if (item.multi) setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]))
    else setPicked([key])
  }

  // Judged by the Game Master in the admin panel - nothing to submit here
  if (check === 'host') {
    return (
      <div className="verdict">
        <p className="eyebrow">{label(q)} · {q.price} fc</p>
        <p className="question">{item.text}</p>
        <p className="msg info">{GAME_MASTER_TEXT}</p>
        <button className="btn primary" onClick={onClose}>OK</button>
      </div>
    )
  }

  const ready = check === 'choice' ? picked.length > 0 : text.trim() !== ''

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(check === 'choice' ? picked : text)
      }}
    >
      <p className="eyebrow">{label(q)} · {q.price} fc</p>
      <p className="question">{item.text}</p>
      {check === 'choice' && (
        <div className="options">
          {item.multi && <p className="muted">Select all that apply.</p>}
          {item.options.map((o) => (
            <label key={o.key} className={`option ${picked.includes(o.key) ? 'picked' : ''}`}>
              <input
                type={item.multi ? 'checkbox' : 'radio'}
                name="answer"
                checked={picked.includes(o.key)}
                onChange={() => toggle(o.key)}
              />
              <span className="option-key">{o.key}</span>
              <span>{o.text}</span>
            </label>
          ))}
        </div>
      )}
      {check === 'number' && (
        <label>
          The answer is a number
          <input inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        </label>
      )}
      {check === 'text' && (
        <label>
          Your answer
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        </label>
      )}
      <Feedback msg={msg} />
      <button className="btn primary" disabled={busy || !ready}>Submit answer</button>
    </form>
  )
}
