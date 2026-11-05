// Compiles ../Secrets/*.ini into src/generated/secrets.js (git-ignored).
// Answers are stored only as salted SHA-256 hashes;
// hints, question texts and riddle keywords are obfuscated (see src/lib/vault.js).
// Runs automatically before `npm run dev` and `npm run build`.
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeChoice, normalizeCompact, normalizeNumber, normalizeText, secretHash } from '../src/lib/normalize.js'
import { seal } from '../src/lib/vault.js'

const APP = join(dirname(fileURLToPath(import.meta.url)), '..')
const SECRETS = process.env.SECRETS_DIR || join(APP, '..', 'Secrets')
const OUT = process.env.SECRETS_OUT || join(APP, 'src', 'generated', 'secrets.js')

const QUIZ_IDS = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6']
// How a riddle is checked (questions.ini `check = ...` overrides):
//   host   - the team tells the answer to the Game Master, who judges it in the admin panel
//   number - numeric answer field, compared with answers.ini `answer`
//   text   - free text, compared with answers.ini `answer` alternatives or `keywords`
const DEFAULT_CHECK = { R1: 'host', R2: 'host', R3: 'host', R4: 'host', R5: 'number', R6: 'number' }
const DEFAULT_PRICES = { Q1: 3, Q2: 5, Q3: 10, Q4: 10, Q5: 10, Q6: 10, R1: 10, R2: 15, R3: 20, R4: 30, R5: 50, R6: 60 }

const warnings = []
const warn = (msg) => warnings.push(msg)

/** Reads Secrets/x.ini, x.ini.txt or x.txt (Windows likes to add/replace with .txt). */
function readSecret(name) {
  for (const file of [name, `${name}.txt`, name.replace(/\.ini$/, '.txt')]) {
    const path = join(SECRETS, file)
    if (existsSync(path)) return readFileSync(path, 'utf8').replace(/^﻿/, '')
  }
  warn(`missing ${name}`)
  return ''
}

/**
 * Plain list file: one entry per line, either just the value or "label = value" / "label: value"
 * with label answer, hint, hint1, password ... Surrounding quotes are removed; ; and # are comments.
 */
function parseList(src) {
  return src
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^[;#[]/.test(l))
    .map((l) => l.replace(/^(answer|hint|password)\s*\d*\s*[:=]\s*/i, ''))
    .map((l) => l.replace(/^"(.*)"$/, '$1').trim())
    .filter(Boolean)
}

/**
 * Sectioned ini: { SECTION: { key: value } }. Keys are case-insensitive (lower-cased).
 * A line without "key =" continues the previous value on a new line (so a question may span lines).
 */
function parseIni(src) {
  const out = {}
  let cur = null
  let last = null
  for (const raw of src.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || /^[;#]/.test(line)) continue
    const sec = line.match(/^\[(.+)\]$/)
    if (sec) {
      cur = out[sec[1].trim().toUpperCase()] = {}
      last = null
      continue
    }
    if (!cur) continue
    const kv = line.match(/^([a-z][\w-]{0,15})\s*=\s*(.*)$/i)
    if (kv) {
      last = kv[1].toLowerCase()
      cur[last] = kv[2].replace(/\\n/g, '\n')
    } else if (last) {
      cur[last] += `\n${line.replace(/\\n/g, '\n')}`
    }
  }
  return out
}

const isTodo = (s) => !s || /^todo\b/i.test(s.trim())

const salt = randomBytes(16).toString('hex')
const key = randomBytes(32).toString('base64')

// ---- post 1: answers + hints
const post1Answers = parseList(readSecret('post1.ini'))
if (!post1Answers.length) warn('post1.ini has no answers - nobody can solve post 1')
// Alternatives may also share one line, separated by |. Compared without spaces/dots: "D.M.M." = "dmm"
const post1Alternatives = post1Answers.flatMap((a) => a.split('|')).map(normalizeCompact).filter(Boolean)
const post1 = await Promise.all([...new Set(post1Alternatives)].map((a) => secretHash(salt, 'post1', a)))
const hints = parseList(readSecret('hint1.ini'))
if (!hints.length) warn('hint1.ini has no hints - "buy hint" will be disabled')

// ---- quiz
const questions = parseIni(readSecret('questions.ini'))
const answers = parseIni(readSecret('answers.ini'))
const quiz = []
const quizAnswers = {}
for (const id of QUIZ_IDS) {
  const q = questions[id] || {}
  const a = answers[id] || {}
  const kind = id.startsWith('Q') ? 'question' : 'riddle'
  const price = Number.parseInt(q.price, 10) || DEFAULT_PRICES[id]
  const item = { id, kind, price, text: q.text || '' }
  if (isTodo(item.text)) warn(`${id}: question text missing`)

  if (kind === 'question') {
    item.options = ['A', 'B', 'C', 'D', 'E', 'F'].filter((l) => q[l.toLowerCase()]).map((l) => ({ key: l, text: q[l.toLowerCase()] }))
    const correct = isTodo(a.answer) ? '' : normalizeChoice(a.answer)
    item.multi = correct.length > 1
    if (!correct) warn(`${id}: answer missing`)
    quizAnswers[id] = correct ? [await secretHash(salt, id, correct)] : []
  } else {
    item.check = (q.check || DEFAULT_CHECK[id]).toLowerCase()
    if (!['host', 'number', 'text'].includes(item.check)) {
      warn(`${id}: unknown check "${item.check}" - using text`)
      item.check = 'text'
    }
    const norm = item.check === 'number' ? normalizeNumber : normalizeText
    const alts = item.check === 'host' || isTodo(a.answer) ? [] : a.answer.split('|').map(norm).filter(Boolean)
    quizAnswers[id] = await Promise.all(alts.map((v) => secretHash(salt, id, v)))
    item.keywords = item.check !== 'text' || isTodo(a.keywords) ? [] : a.keywords.split(',').map(normalizeText).filter(Boolean)
    if (item.check !== 'host' && !alts.length && !item.keywords.length) warn(`${id}: answer missing`)
  }
  quiz.push(item)
}

// Prices and kinds are public (shown on the cards); everything else is sealed.
const publicQuiz = quiz.map(({ id, kind, price, check }) => ({ id, kind, price, check }))
const sealedQuiz = Object.fromEntries(quiz.map((q) => [q.id, seal(q, key)]))

const file = `// GENERATED by scripts/build-secrets.mjs from ../Secrets - do not edit, do not commit.
export const SECRETS = ${JSON.stringify(
  {
    salt,
    key,
    post1,
    hintCount: hints.length,
    hints: seal(hints, key),
    quiz: publicQuiz,
    sealedQuiz,
    quizAnswers,
  },
  null,
  2,
)}
`
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, file)

console.log(`secrets: compiled from ${SECRETS}`)
for (const w of warnings) console.warn(`  ! ${w}`)
