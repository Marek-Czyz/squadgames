// Firestore security rules test. Run with: npm run test:rules (starts the emulator itself)
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { deleteDoc, doc, getDoc, setDoc, updateDoc, writeBatch } from 'firebase/firestore'

let env
const team = (name) => ({ teamName: name, email: `${name}@x`, credit: 100, post1: {}, quiz: {} })

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8085 },
  })
})
afterAll(() => env.cleanup())
beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'admins/boss'), { email: 'boss@x' })
    await setDoc(doc(db, 'hosts/helper'), { email: 'helper@x' })
    await setDoc(doc(db, 'teams/alice'), team('alice'))
    await setDoc(doc(db, 'teams/bob'), team('bob'))
    await setDoc(doc(db, 'teams/bob/log/1'), { delta: 5 })
  })
})

describe('scoreboard', () => {
  it('is readable by everyone, even signed out', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'scoreboard/alice'), { teamName: 'alice', credit: 100 }))
    await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'scoreboard/alice')))
  })
  it('a team can only publish its real name and credit', async () => {
    const db = env.authenticatedContext('alice').firestore()
    await assertSucceeds(setDoc(doc(db, 'scoreboard/alice'), { teamName: 'alice', credit: 100 }))
    await assertFails(setDoc(doc(db, 'scoreboard/alice'), { teamName: 'alice', credit: 999 }))
    await assertFails(setDoc(doc(db, 'scoreboard/alice'), { teamName: 'alice', credit: 100, email: 'x' }))
    await assertFails(setDoc(doc(db, 'scoreboard/bob'), { teamName: 'bob', credit: 100 }))
  })
  it('credit change + scoreboard in one batch is allowed when they match', async () => {
    const db = env.authenticatedContext('alice').firestore()
    const batch = writeBatch(db)
    batch.update(doc(db, 'teams/alice'), { credit: 150 })
    batch.set(doc(db, 'scoreboard/alice'), { teamName: 'alice', credit: 150 })
    await assertSucceeds(batch.commit())
  })
  it('only admins delete scoreboard entries', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'scoreboard/bob'), { teamName: 'bob', credit: 1 }))
    await assertFails(deleteDoc(doc(env.authenticatedContext('bob').firestore(), 'scoreboard/bob')))
    await assertSucceeds(deleteDoc(doc(env.authenticatedContext('boss').firestore(), 'scoreboard/bob')))
  })
})

describe('hosts', () => {
  it('only admins add or remove hosts', async () => {
    await assertFails(setDoc(doc(env.authenticatedContext('alice').firestore(), 'hosts/alice'), { email: 'a' }))
    await assertFails(setDoc(doc(env.authenticatedContext('helper').firestore(), 'hosts/bob'), { email: 'b' }))
    const boss = env.authenticatedContext('boss').firestore()
    await assertSucceeds(setDoc(doc(boss, 'hosts/bob'), { email: 'b' }))
    await assertSucceeds(deleteDoc(doc(boss, 'hosts/bob')))
  })
  it('a host can read teams and change only credit + host points', async () => {
    const db = env.authenticatedContext('helper').firestore()
    await assertSucceeds(getDoc(doc(db, 'teams/alice')))
    await assertSucceeds(getDoc(doc(db, 'hosts/helper')))
    const batch = writeBatch(db)
    batch.update(doc(db, 'teams/alice'), { credit: 110, 'hostPoints.post2': 10 })
    batch.set(doc(db, 'teams/alice/log/h1'), { delta: 10 })
    batch.set(doc(db, 'scoreboard/alice'), { teamName: 'alice', credit: 110 })
    await assertSucceeds(batch.commit())
    await assertFails(updateDoc(doc(db, 'teams/alice'), { 'quiz.R1': 'solved' }))
    await assertFails(updateDoc(doc(db, 'teams/alice'), { teamName: 'x' }))
    await assertFails(setDoc(doc(db, 'scoreboard/alice'), { teamName: 'alice', credit: 999 }))
    await assertFails(getDoc(doc(db, 'teams/alice/log/h1'))) // hosts do not read logs
    await assertFails(deleteDoc(doc(db, 'teams/alice')))
  })
  it('a host account cannot create a team', async () => {
    const db = env.authenticatedContext('helper').firestore()
    await assertFails(setDoc(doc(db, 'teams/helper'), team('helper')))
  })
})

describe('teams', () => {
  it('own team: read + update credit, but not rename', async () => {
    const db = env.authenticatedContext('alice').firestore()
    await assertSucceeds(getDoc(doc(db, 'teams/alice')))
    await assertSucceeds(updateDoc(doc(db, 'teams/alice'), { credit: 90 }))
    await assertFails(updateDoc(doc(db, 'teams/alice'), { teamName: 'x' }))
    await assertFails(deleteDoc(doc(db, 'teams/alice'))) // only admins delete teams
  })
  it('other teams are off limits', async () => {
    const db = env.authenticatedContext('alice').firestore()
    await assertFails(getDoc(doc(db, 'teams/bob')))
    await assertFails(updateDoc(doc(db, 'teams/bob'), { credit: 0 }))
    await assertFails(getDoc(doc(db, 'teams/bob/log/1')))
    await assertFails(deleteDoc(doc(db, 'teams/bob/log/1')))
  })
  it('nobody can make themselves admin', async () => {
    const db = env.authenticatedContext('alice').firestore()
    await assertFails(setDoc(doc(db, 'admins/alice'), { x: 1 }))
    await assertFails(getDoc(doc(db, 'admins/boss')))
  })
  it('admin can read, reset and clear logs of any team', async () => {
    const db = env.authenticatedContext('boss').firestore()
    await assertSucceeds(getDoc(doc(db, 'admins/boss')))
    await assertSucceeds(getDoc(doc(db, 'teams/bob')))
    await assertSucceeds(updateDoc(doc(db, 'teams/bob'), { credit: 100, quiz: {} }))
    await assertSucceeds(deleteDoc(doc(db, 'teams/bob/log/1')))
    await assertSucceeds(setDoc(doc(db, 'teams/bob/log/2'), { delta: 20 })) // judging a riddle logs for the team
    await assertSucceeds(deleteDoc(doc(db, 'teams/bob')))
  })
  it('signed-out users get nothing', async () => {
    const db = env.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'teams/alice')))
  })
})
