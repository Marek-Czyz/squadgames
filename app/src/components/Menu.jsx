import { HOST_POSTS, hostTotal } from '../lib/game.js'
import { QUIZ } from '../lib/secrets.js'
import { POSTS } from '../posts.js'
import Scoreboard from './Scoreboard.jsx'

function status(post, team) {
  if (post.id === 1) return team.post1.solved ? 'Solved' : null
  if (HOST_POSTS[post.id]) {
    const total = hostTotal(team, post.id)
    return total ? `${total > 0 ? '+' : ''}${total} fc` : null
  }
  if (post.id === 3) {
    const solved = QUIZ.filter((q) => team.quiz[q.id]?.state === 'solved').length
    return `${solved} / ${QUIZ.length} solved`
  }
  return null
}

export default function Menu({ uid, team, onOpen }) {
  return (
    <>
      <h1 className="menu-title">Choose your post</h1>
      <div className="post-grid">
        {POSTS.map((p) => {
          const s = status(p, team)
          return (
            <button key={p.id} className="post-card" style={{ '--accent': p.accent, '--tint': p.tint }} onClick={() => onOpen(p.id)}>
              <span className="badge">{p.id}</span>
              <span className="eyebrow">Post {p.id}</span>
              <span className="post-card-title">{p.title}</span>
              <span className="post-card-sub">{p.subtitle}</span>
              {s && <span className="chip">{s}</span>}
              <span className="shapes" aria-hidden>
                <i className="s-circle" /><i className="s-triangle" /><i className="s-square" />
              </span>
            </button>
          )
        })}
      </div>
      <Scoreboard highlightUid={uid} />
    </>
  )
}
