// Keeps the newest known copy of each team doc.
//
// Transactions are committed separately from the live snapshot stream. On some networks that
// stream lags behind, so the UI could keep showing the state from before a successful action
// (e.g. a quiz card still "bought" after a correct answer). Every transaction therefore
// publishes the state it just wrote, and views use whichever copy has the higher `rev`.
import { FieldValue, Timestamp } from 'firebase/firestore'
import { useSyncExternalStore } from 'react'

const latest = new Map() // team id -> team data written by this browser
const subscribers = new Set()
let version = 0

export function publishTeam(id, data) {
  latest.set(id, data)
  version++
  subscribers.forEach((fn) => fn())
}

export function forgetTeam(id) {
  latest.delete(id)
  version++
  subscribers.forEach((fn) => fn())
}

const createdMs = (t) => t?.createdAt?.toMillis?.() ?? null

/** The newer of the live snapshot `data` and the copy this browser wrote itself. */
export function freshest(id, data) {
  const mine = latest.get(id)
  if (!mine || !data) return data
  // A team that was removed and created again is a different team
  if (createdMs(mine) !== createdMs(data)) return data
  return (mine.rev ?? 0) > (data.rev ?? 0) ? mine : data
}

/** Re-renders the component whenever this browser publishes a newer team copy. */
export function useFreshTeams() {
  useSyncExternalStore(
    (fn) => {
      subscribers.add(fn)
      return () => subscribers.delete(fn)
    },
    () => version,
  )
  return freshest
}

/** The team doc as it is after `update` (dotted field paths; server timestamps become "now"). */
export function applyUpdate(team, update) {
  const out = { ...team }
  for (const [path, raw] of Object.entries(update)) {
    const value = raw instanceof FieldValue ? Timestamp.now() : raw
    const keys = path.split('.')
    let node = out
    for (const k of keys.slice(0, -1)) {
      node[k] = { ...(node[k] ?? {}) }
      node = node[k]
    }
    node[keys.at(-1)] = value
  }
  return out
}
