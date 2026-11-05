import { useState } from 'react'
import {
  buyHint,
  buyTime,
  cooldownLeft,
  HINT_PRICE,
  POST1_REWARD,
  post1Guess,
  TIME_PRICE,
} from '../lib/game.js'
import { useAction, useNow } from '../lib/hooks.js'
import { boughtHints, HINT_COUNT, isPost1Answer } from '../lib/secrets.js'
import Feedback from './Feedback.jsx'

export default function Post1({ uid, team }) {
  const p1 = team.post1
  const [guess, setGuess] = useState('')
  const { busy, msg, setMsg, run } = useAction()
  const now = useNow(Boolean(p1.lastWrongAt) && !p1.solved)
  const wait = p1.solved ? 0 : cooldownLeft(p1.lastWrongAt, now)
  const hints = boughtHints(p1.hintsBought)

  async function submit(e) {
    e.preventDefault()
    const text = guess.trim()
    if (!text) return
    await run(async () => {
      const correct = await isPost1Answer(text)
      await post1Guess(uid, text, correct)
      setGuess('')
    })
  }

  function onBuyTime() {
    run(async () => {
      await buyTime(uid)
      setMsg({ kind: 'ok', text: `+15 seconds bought (-${TIME_PRICE} fc). Show this to the host and lift the cover!` })
    })
  }

  function onBuyHint() {
    run(async () => {
      await buyHint(uid)
      setMsg({ kind: 'ok', text: `New hint unlocked (-${HINT_PRICE} fc).` })
    })
  }

  const noMoreHints = p1.hintsBought >= HINT_COUNT

  return (
    <div className={`panel ${p1.solved ? 'solved' : ''}`}>
      <p>
        Study the hidden item, then type what you think it is. No fc loss for a wrong answer. (If you know the
        answer, the host may help you spell it correctly.)
      </p>
      <form className="row" onSubmit={submit}>
        <input
          className="grow"
          placeholder={p1.solved ? 'Solved!' : 'What is it?'}
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          disabled={p1.solved || wait > 0 || busy}
          aria-label="Your guess"
        />
        <button className="btn primary" disabled={p1.solved || wait > 0 || busy || !guess.trim()}>Guess</button>
      </form>

      {p1.solved && <p className="msg ok big">Solved! You earned +{POST1_REWARD} fc.</p>}
      {wait > 0 && (
        <p className="msg error big">
          Incorrect, next guess in: <strong>{wait}s</strong>
        </p>
      )}
      <Feedback msg={msg} />

      <div className="row buttons">
        <button className="btn" onClick={onBuyTime} disabled={p1.solved || busy}>
          Buy time <small>+15 s · {TIME_PRICE} fc</small>
        </button>
        <button className="btn" onClick={onBuyHint} disabled={p1.solved || busy || noMoreHints}>
          Buy hint <small>{noMoreHints ? 'none left' : `${HINT_PRICE} fc`}</small>
        </button>
      </div>
      <p className="muted">Time bought: {p1.timeBought} × 15 s · Hints: {p1.hintsBought} / {HINT_COUNT}</p>

      {hints.length > 0 && (
        <ol className="hints">
          {hints.map((h, i) => <li key={i}>{h}</li>)}
        </ol>
      )}
    </div>
  )
}
