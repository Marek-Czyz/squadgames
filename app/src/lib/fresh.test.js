import { serverTimestamp, Timestamp } from 'firebase/firestore'
import { describe, expect, it } from 'vitest'
import { applyUpdate, forgetTeam, freshest, publishTeam } from './fresh.js'

const created = Timestamp.fromMillis(1_000)
const team = (rev, state) => ({ teamName: 'A', credit: 100, rev, createdAt: created, quiz: { Q1: { state, purchases: 1 } } })

describe('applyUpdate', () => {
  it('applies dotted paths without touching siblings or the original', () => {
    const before = team(3, 'bought')
    const after = applyUpdate(before, { credit: 106, rev: 4, 'quiz.Q1.state': 'solved' })
    expect(after.quiz.Q1).toEqual({ state: 'solved', purchases: 1 })
    expect(after.credit).toBe(106)
    expect(before.quiz.Q1.state).toBe('bought') // original unchanged
  })

  it('creates missing maps (e.g. hostPoints on an old team doc)', () => {
    expect(applyUpdate(team(1, 'hidden'), { 'hostPoints.post4': -5 }).hostPoints).toEqual({ post4: -5 })
  })

  it('turns server timestamps into a real time (for the guess countdown)', () => {
    const after = applyUpdate(team(1, 'hidden'), { 'post1.lastWrongAt': serverTimestamp() })
    expect(after.post1.lastWrongAt).toBeInstanceOf(Timestamp)
  })
})

describe('freshest', () => {
  it('prefers the copy this browser wrote while the live stream is behind', () => {
    publishTeam('t1', team(5, 'solved'))
    expect(freshest('t1', team(4, 'bought')).quiz.Q1.state).toBe('solved')
  })

  it('uses the live data once it has caught up or is newer (other phone, admin)', () => {
    publishTeam('t2', team(5, 'solved'))
    expect(freshest('t2', team(5, 'solved')).rev).toBe(5)
    expect(freshest('t2', team(6, 'hidden')).quiz.Q1.state).toBe('hidden')
  })

  it('ignores the stored copy for a removed and re-created team', () => {
    publishTeam('t3', team(9, 'solved'))
    const recreated = { ...team(0, 'hidden'), createdAt: Timestamp.fromMillis(2_000) }
    expect(freshest('t3', recreated)).toBe(recreated)
    forgetTeam('t3')
    expect(freshest('t3', team(0, 'hidden')).rev).toBe(0)
  })

  it('keeps "no team" as no team', () => {
    publishTeam('t4', team(2, 'bought'))
    expect(freshest('t4', null)).toBe(null)
  })
})
