import { hostTotal } from '../lib/game.js'

/** Team view of a host-run post (2, 4, 5): the rules and what the host has given so far. */
export default function HostPost({ team, post }) {
  const total = hostTotal(team, post.id)
  return (
    <div className="panel">
      {post.intro.map((p) => <p key={p}>{p}</p>)}
      <p className={`msg ${total < 0 ? 'error' : total > 0 ? 'ok' : 'info'} big`}>
        {total === 0 ? 'No fc from this post yet.' : `You gained at this post: ${total > 0 ? '+' : ''}${total} fc`}
      </p>
    </div>
  )
}
