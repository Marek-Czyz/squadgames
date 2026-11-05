// Light obfuscation for content that must be revealed in the browser later
// (hints, question texts). It keeps the secrets out of plain sight in the
// bundle; it is NOT encryption - the key ships with the app.

export function seal(obj, keyB64) {
  const key = fromB64(keyB64)
  const bytes = new TextEncoder().encode(JSON.stringify(obj))
  return toB64(bytes.map((b, i) => b ^ key[i % key.length]))
}

export function unseal(blobB64, keyB64) {
  const key = fromB64(keyB64)
  const bytes = fromB64(blobB64).map((b, i) => b ^ key[i % key.length])
  return JSON.parse(new TextDecoder().decode(bytes))
}

function toB64(bytes) {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

function fromB64(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}
