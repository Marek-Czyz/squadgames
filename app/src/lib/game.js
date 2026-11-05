// All credit changes go through a Firestore transaction so the balance stays
// consistent even if a team plays from several phones at once. Every change
// is also written to teams/{uid}/log for the hosts, and mirrored to the public
// scoreboard/{uid} (team name + credit only).
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  runTransaction,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore'
import { auth, createAccountAside, db } from '../firebase.js'
import { applyUpdate, forgetTeam, publishTeam } from './fresh.js'
import { HINT_COUNT, QUIZ } from './secrets.js'

export const START_CREDIT = 100
export const POST1_REWARD = 50
export const TIME_PRICE = 5
export const HINT_PRICE = 10
export const WRONG_GUESS_COOLDOWN_S = 59

/** Host-run posts: button step and the allowed total per team at that post (min null = no lower limit). */
export const HOST_POSTS = {
  2: { step: 10, min: 0, max: 50 },
  4: { step: 5, min: null, max: 50 }, // teams can lose as well as win
  5: { step: 5, min: -25, max: 25 }, // each round won takes 5 fc from the other team
}

export class GameError extends Error {}

export const teamRef = (uid) => doc(db, 'teams', uid)
export const scoreRef = (uid) => doc(db, 'scoreboard', uid)

/** Public scoreboard entry - kept in step with the team doc (enforced by the security rules). */
export function syncScore(uid, team) {
  return setDoc(scoreRef(uid), { teamName: team.teamName, credit: team.credit })
}

export async function teamExists(uid) {
  return (await getDoc(teamRef(uid))).exists()
}

/** Game progress of a fresh team (also what a reset goes back to). */
function initialProgress() {
  return {
    credit: START_CREDIT,
    post1: { solved: false, hintsBought: 0, timeBought: 0, wrongGuesses: 0, lastWrongAt: null },
    quiz: Object.fromEntries(QUIZ.map((q) => [q.id, { state: 'hidden', purchases: 0 }])),
    hostPoints: { post2: 0, post4: 0, post5: 0 }, // fc given by hosts at each host-run post
  }
}

export async function createTeam(user, teamName) {
  const name = teamName.trim()
  if (!name) throw new GameError('Please enter a team name.')
  const batch = writeBatch(db)
  batch.set(teamRef(user.uid), {
    teamName: name,
    email: user.email,
    createdAt: serverTimestamp(),
    ...initialProgress(),
  })
  batch.set(scoreRef(user.uid), { teamName: name, credit: START_CREDIT })
  await batch.commit()
}

// ---- admin

/** { admin, host } for the signed-in user. Admins and hosts are listed in admins/{uid} and hosts/{uid}. */
export async function loadRoles(uid) {
  const [admin, host] = await Promise.all([getDoc(doc(db, 'admins', uid)), getDoc(doc(db, 'hosts', uid))])
  return { admin: admin.exists(), host: host.exists() }
}

/** Admin: creates a host login (no team is created for it). */
export async function addHost(email, password) {
  const uid = await createAccountAside(email.trim(), password)
  await setDoc(doc(db, 'hosts', uid), { email: email.trim(), createdAt: serverTimestamp() })
}

/** Admin: removes the host role. The login itself stays (delete it in the Firebase console). */
export function removeHost(uid) {
  return deleteDoc(doc(db, 'hosts', uid))
}

/** Deletes the team's log and applies `teamOp(batch, ref)` to the team doc in the same first batch. */
async function clearLogAnd(uid, teamOp) {
  const ref = teamRef(uid)
  const logs = await getDocs(collection(ref, 'log'))
  const docs = logs.docs.map((d) => d.ref)
  // Firestore batches hold max 500 writes
  for (let i = 0; i < docs.length || i === 0; i += 499) {
    const batch = writeBatch(db)
    if (i === 0) teamOp(batch, ref)
    for (const d of docs.slice(i, i + 499)) batch.delete(d)
    await batch.commit()
  }
}

/** Puts a team back to the start (100 fc, nothing bought or solved) and clears its log. */
export async function resetTeam(uid) {
  const { teamName } = (await getDoc(teamRef(uid))).data()
  return clearLogAnd(uid, (batch, ref) => {
    batch.update(ref, { ...initialProgress(), rewards: deleteField(), rev: increment(1), resetAt: serverTimestamp() })
    batch.set(scoreRef(uid), { teamName, credit: START_CREDIT })
  })
}

/**
 * Removes the team and its log. The login account stays (only the Firebase console can delete it);
 * if it logs in again it is asked for a new team name.
 */
export async function deleteTeam(uid) {
  await clearLogAnd(uid, (batch, ref) => {
    batch.delete(ref)
    batch.delete(scoreRef(uid))
  })
  forgetTeam(uid)
}

export const resetMyGame = (uid) => resetTeam(uid)

/** Resets every team. Returns the number of teams reset. */
export async function resetAllTeams() {
  const teams = await getDocs(collection(db, 'teams'))
  for (const t of teams.docs) await resetTeam(t.id)
  return teams.size
}

/**
 * Runs `decide(team)` inside a transaction. It returns
 * { delta, patch, log } (or throws GameError to abort without changes).
 */
async function transact(uid, decide) {
  const ref = teamRef(uid)
  const after = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new GameError('Team not found.')
    const team = snap.data()
    const { delta = 0, patch = {}, log } = decide(team)
    const credit = team.credit + delta
    // rev goes up with every change, so views can tell which copy of the team is newer
    const update = { credit, rev: (team.rev ?? 0) + 1, ...patch }
    tx.update(ref, update)
    tx.set(doc(collection(ref, 'log')), { ...log, delta, creditAfter: credit, at: serverTimestamp() })
    tx.set(scoreRef(uid), { teamName: team.teamName, credit })
    return applyUpdate(team, update)
  })
  publishTeam(uid, after) // show the result right away, even if the live stream lags
  return { credit: after.credit }
}


function requireFunds(team, price) {
  if (team.credit < price) throw new GameError(`Not enough fc - this costs ${price} fc.`)
}

function requirePost1Open(team) {
  if (team.post1.solved) throw new GameError('This post is already solved.')
}

export function cooldownLeft(lastWrongAt, now = Date.now()) {
  if (!lastWrongAt) return 0
  const ms = lastWrongAt.toMillis() + WRONG_GUESS_COOLDOWN_S * 1000 - now
  return Math.max(0, Math.ceil(ms / 1000))
}

// ---- post 1

export function post1Guess(uid, guess, correct) {
  return transact(uid, (team) => {
    requirePost1Open(team)
    if (cooldownLeft(team.post1.lastWrongAt) > 0) throw new GameError('Wait for the countdown.')
    if (correct) {
      return {
        delta: POST1_REWARD,
        patch: { 'post1.solved': true, 'post1.solvedAt': serverTimestamp() },
        log: { post: 1, type: 'guess-correct', guess },
      }
    }
    return {
      patch: { 'post1.lastWrongAt': serverTimestamp(), 'post1.wrongGuesses': team.post1.wrongGuesses + 1 },
      log: { post: 1, type: 'guess-wrong', guess },
    }
  })
}

export function buyTime(uid) {
  return transact(uid, (team) => {
    requirePost1Open(team)
    requireFunds(team, TIME_PRICE)
    return {
      delta: -TIME_PRICE,
      patch: { 'post1.timeBought': team.post1.timeBought + 1 },
      log: { post: 1, type: 'buy-time' },
    }
  })
}

export function buyHint(uid) {
  return transact(uid, (team) => {
    requirePost1Open(team)
    if (team.post1.hintsBought >= HINT_COUNT) throw new GameError('No more hints available.')
    requireFunds(team, HINT_PRICE)
    return {
      delta: -HINT_PRICE,
      patch: { 'post1.hintsBought': team.post1.hintsBought + 1 },
      log: { post: 1, type: 'buy-hint', hint: team.post1.hintsBought + 1 },
    }
  })
}

// ---- posts 2, 4, 5 (hosts press +/- for a team)

export const hostTotal = (team, post) => team.hostPoints?.[`post${post}`] ?? 0

/** Host (or admin) gives `delta` fc to a team at a host-run post, within the post's limits. */
export function hostAward(uid, post, delta) {
  const { min, max } = HOST_POSTS[post]
  return transact(uid, (team) => {
    const next = hostTotal(team, post) + delta
    if ((min !== null && next < min) || next > max) {
      throw new GameError(min === null ? `Post ${post} allows at most ${max} fc per team.` : `Post ${post} allows ${min} to ${max} fc per team.`)
    }
    return {
      delta,
      patch: { [`hostPoints.post${post}`]: next },
      log: { post, type: 'host-award', by: auth.currentUser?.email ?? '' },
    }
  })
}

// ---- post 3 (quiz)

const quizPrice = (id) => QUIZ.find((q) => q.id === id).price

export function buyQuiz(uid, id) {
  return transact(uid, (team) => {
    const entry = team.quiz[id]
    if (entry.state !== 'hidden') throw new GameError('This card is not for sale right now.')
    const price = quizPrice(id)
    requireFunds(team, price)
    return {
      delta: -price,
      patch: { [`quiz.${id}.state`]: 'bought', [`quiz.${id}.purchases`]: entry.purchases + 1 },
      log: { post: 3, type: 'buy-quiz', id },
    }
  })
}

export function answerQuiz(uid, id, answer, correct) {
  return transact(uid, (team) => {
    if (team.quiz[id].state !== 'bought') throw new GameError('Buy this card first.')
    const price = quizPrice(id)
    return {
      delta: correct ? price * 2 : 0,
      patch: { [`quiz.${id}.state`]: correct ? 'solved' : 'hidden' },
      log: { post: 3, type: correct ? 'quiz-correct' : 'quiz-wrong', id, answer: String(answer) },
    }
  })
}

/** Game Master verdict (admin panel) on a riddle the team has bet on and answered verbally. */
export function judgeRiddle(uid, id, correct) {
  return answerQuiz(uid, id, `game master: ${correct ? 'correct' : 'wrong'}`, correct)
}
