// Shared by the browser app and scripts/build-secrets.mjs, so both sides
// normalise answers exactly the same way before hashing / comparing.

/** Lower-case, strip punctuation, collapse whitespace. Keeps letters (incl. æøå) and digits. */
export function normalizeText(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** Like normalizeText but also without spaces: "D.M.M." and "Dmm" both become "dmm". */
export function normalizeCompact(s) {
  return normalizeText(s).replace(/ /g, '')
}

/** Numeric answer -> canonical form: ' 1 000,50 ' -> '1000.5'. Non-numbers fall back to normalizeText. */
export function normalizeNumber(s) {
  const cleaned = String(s ?? '').replace(/[\s  ]/g, '').replace(',', '.')
  const n = Number(cleaned)
  return cleaned !== '' && Number.isFinite(n) ? String(n) : normalizeText(s)
}

/** Multiple-choice selection -> canonical form, e.g. ['D', 'b'] -> 'BD'. */
export function normalizeChoice(letters) {
  const list = Array.isArray(letters) ? letters : String(letters).split(/[\s,;]+/)
  return [...new Set(list.map((l) => l.trim().toUpperCase()).filter(Boolean))].sort().join('')
}

export async function sha256Hex(text) {
  const data = new TextEncoder().encode(text)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Salted, scoped hash: the same answer in two different posts yields different hashes. */
export function secretHash(salt, scope, value) {
  return sha256Hex(`${salt}:${scope}:${value}`)
}
