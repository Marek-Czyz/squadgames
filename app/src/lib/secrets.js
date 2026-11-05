import { SECRETS } from '../generated/secrets.js'
import { normalizeChoice, normalizeCompact, normalizeNumber, normalizeText, secretHash } from './normalize.js'
import { unseal } from './vault.js'

/** Answer checking over a compiled secrets object (see scripts/build-secrets.mjs). */
export function createSecrets(S) {
  const hash = (scope, value) => secretHash(S.salt, scope, value)
  const quizItem = (id) => unseal(S.sealedQuiz[id], S.key)

  return {
    HINT_COUNT: S.hintCount,
    QUIZ: S.quiz, // [{ id, kind, price, check }] - public info only

    async isPost1Answer(guess) {
      return S.post1.includes(await hash('post1', normalizeCompact(guess)))
    },

    /** The first `n` hints (only call with n = number of hints the team has paid for). */
    boughtHints(n) {
      return n > 0 ? unseal(S.hints, S.key).slice(0, n) : []
    },

    /** Full question / riddle content - reveal only after purchase. */
    quizItem,

    /** What the compiled Secrets contain - for the admin page, without revealing answers. */
    summary() {
      return {
        post1Answers: S.post1.length,
        hints: S.hintCount,
        quiz: S.quiz.map(({ id, price }) => {
          const item = quizItem(id)
          const hasAnswer = item.check === 'host' || S.quizAnswers[id].length > 0 || (item.keywords?.length ?? 0) > 0
          const type = item.kind === 'question'
            ? (item.multi ? 'multi-select' : 'single choice')
            : { host: 'riddle (Game Master)', number: 'riddle (number)', text: item.keywords.length ? 'riddle (keywords)' : 'riddle (text)' }[item.check]
          return { id, price, hasText: Boolean(item.text) && !/^todo\b/i.test(item.text), hasAnswer, type }
        }),
      }
    },

    /** answer: array of letters for questions, text/number for riddles. Host-checked riddles are never auto-correct. */
    async isQuizAnswer(id, answer) {
      const item = quizItem(id)
      if (item.kind === 'question') {
        const choice = normalizeChoice(answer)
        return Boolean(choice) && S.quizAnswers[id].includes(await hash(id, choice))
      }
      if (item.check === 'host') return false
      const text = item.check === 'number' ? normalizeNumber(answer) : normalizeText(answer)
      if (!text) return false
      if (S.quizAnswers[id].includes(await hash(id, text))) return true
      return item.keywords.length > 0 && item.keywords.every((k) => text.includes(k))
    },
  }
}

export const {
  HINT_COUNT, QUIZ, isPost1Answer, boughtHints, quizItem, isQuizAnswer,
  summary: secretsSummary,
} =
  createSecrets(SECRETS)
