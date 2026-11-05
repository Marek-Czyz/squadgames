import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { normalizeChoice, normalizeText } from './normalize.js'
import { createSecrets } from './secrets.js'

const FIXTURE = {
  'post1.txt': '; the item\nanswer = Digital Multimeter\nanswer: multimeter | D.M.M.\n',
  'hint1.ini.txt': 'hint = It measures things\nHINT2: "It has probes"\n',
  'questions.ini': [
    '[Q1]', 'price = 3', 'text = Pick C\\nplease', 'A = a', 'B = b', 'C = c', 'D = d',
    '[Q6]', 'text = First line', 'Second line without key', 'A = a', 'B = b', 'C = c', 'D = d', 'E = e',
    '[Q4]', 'price = 10', 'text = Pick B and D', 'A = a', 'B = b', 'C = c', 'D = d',
    '[R1]', 'price = 10', 'text = How?', 'check = text',
    '[R2]', 'text = Explain to the host',
    '[R5]', 'text = How many?',
    '[R6]', 'text = Big number',
  ].join('\n'),
  'answers.ini': [
    '[Q1]', 'answer = C', '[Q4]', 'answer = B, D', '[Q6]', 'answer = E', '[R1]', 'keywords = both ends, middle',
    '[R5]', 'answer = 14 | fourteen', '[R6]', 'answer = 1 000,5',
  ].join('\n'),
}

let S
let raw

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'squad-secrets-'))
  for (const [f, c] of Object.entries(FIXTURE)) writeFileSync(join(dir, f), c)
  const out = join(dir, 'secrets.js')
  execFileSync(process.execPath, ['scripts/build-secrets.mjs'], {
    env: { ...process.env, SECRETS_DIR: dir, SECRETS_OUT: out },
    stdio: 'pipe',
  })
  raw = readFileSync(out, 'utf8')
  S = createSecrets((await import(pathToFileURL(out).href)).SECRETS)
})

describe('normalize', () => {
  it('ignores case, punctuation and spacing', () => {
    expect(normalizeText('  Digital-MULTIMETER!! ')).toBe('digital multimeter')
    expect(normalizeText('Blåbær')).toBe('blåbær')
  })
  it('canonicalises multiple choice', () => {
    expect(normalizeChoice(['d', 'B', 'b'])).toBe('BD')
    expect(normalizeChoice('B, D')).toBe('BD')
  })
})

describe('compiled secrets', () => {
  it('keeps answers, hints and question texts out of plain text', () => {
    for (const s of ['multimeter', 'It has probes', 'Pick B and D', 'fourteen', 'both ends']) {
      expect(raw).not.toContain(s)
    }
  })

  it('checks post 1 guesses (any listed answer, case-insensitive)', async () => {
    expect(await S.isPost1Answer('multimeter')).toBe(true)
    expect(await S.isPost1Answer('DIGITAL multimeter.')).toBe(true)
    expect(await S.isPost1Answer('oscilloscope')).toBe(false)
    expect(await S.isPost1Answer('')).toBe(false)
  })

  it('reads "answer: a | b" lines and ignores dots/spaces in post 1 (D.M.M. = DMM)', async () => {
    expect(await S.isPost1Answer('D.M.M.')).toBe(true)
    expect(await S.isPost1Answer('dmm')).toBe(true)
    expect(await S.isPost1Answer('d m m')).toBe(true)
    expect(await S.isPost1Answer('answer multimeter')).toBe(false) // the "answer:" label is not part of it
  })

  it('reveals only bought hints, in order, without labels or quotes', () => {
    expect(S.HINT_COUNT).toBe(2)
    expect(S.boughtHints(0)).toEqual([])
    expect(S.boughtHints(1)).toEqual(['It measures things'])
    expect(S.boughtHints(2)).toEqual(['It measures things', 'It has probes'])
  })

  it('continues a question on lines without a key, and supports option E', async () => {
    const q6 = S.quizItem('Q6')
    expect(q6.text).toBe('First line\nSecond line without key')
    expect(q6.options.map((o) => o.key)).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(await S.isQuizAnswer('Q6', ['E'])).toBe(true)
  })

  it('uses prices from questions.ini, defaults otherwise', () => {
    const price = Object.fromEntries(S.QUIZ.map((q) => [q.id, q.price]))
    expect(price.Q1).toBe(3)
    expect(price.R5).toBe(50)
    expect(price.R6).toBe(60)
    expect(S.QUIZ).toHaveLength(12)
  })

  it('checks single and multi-select questions', async () => {
    expect(S.quizItem('Q1').text).toBe('Pick C\nplease')
    expect(S.quizItem('Q1').multi).toBe(false)
    expect(await S.isQuizAnswer('Q1', ['C'])).toBe(true)
    expect(await S.isQuizAnswer('Q1', ['A'])).toBe(false)
    expect(S.quizItem('Q4').multi).toBe(true)
    expect(await S.isQuizAnswer('Q4', ['D', 'B'])).toBe(true)
    expect(await S.isQuizAnswer('Q4', ['B'])).toBe(false)
    expect(await S.isQuizAnswer('Q4', [])).toBe(false)
  })

  it('defaults to Game Master check for R1-R4 and number check for R5-R6; check = ... overrides', () => {
    const check = Object.fromEntries(['R1', 'R2', 'R3', 'R4', 'R5', 'R6'].map((id) => [id, S.quizItem(id).check]))
    expect(check).toEqual({ R1: 'text', R2: 'host', R3: 'host', R4: 'host', R5: 'number', R6: 'number' })
  })

  it('checks text riddles by keywords', async () => {
    expect(await S.isQuizAnswer('R1', 'Light both ends of rope 1, then the middle...')).toBe(true)
    expect(await S.isQuizAnswer('R1', 'light both ends')).toBe(false)
  })

  it('checks number riddles regardless of formatting', async () => {
    expect(await S.isQuizAnswer('R5', ' 14 ')).toBe(true)
    expect(await S.isQuizAnswer('R5', '14.0')).toBe(true)
    expect(await S.isQuizAnswer('R5', '13')).toBe(false)
    expect(await S.isQuizAnswer('R6', '1000.5')).toBe(true)
    expect(await S.isQuizAnswer('R6', '1 000,50')).toBe(true)
  })

  it('never auto-accepts Game Master riddles', async () => {
    expect(await S.isQuizAnswer('R2', 'anything')).toBe(false)
    expect(S.QUIZ.find((q) => q.id === 'R2').check).toBe('host') // public, so cards can say "waiting"
  })

})
