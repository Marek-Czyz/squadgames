import { useEffect, useState } from 'react'
import { GameError } from './game.js'

/** Re-renders every `ms` while `active`, returning the current time. */
export function useNow(active, ms = 250) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [active, ms])
  return now
}

/**
 * Wraps async game actions: tracks `busy` and a feedback message
 * ({ kind: 'ok' | 'error', text }).
 */
export function useAction() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  async function run(fn) {
    setBusy(true)
    setMsg(null)
    try {
      return await fn()
    } catch (err) {
      setMsg({ kind: 'error', text: err instanceof GameError ? err.message : `Something went wrong: ${err.message}` })
    } finally {
      setBusy(false)
    }
  }

  return { busy, msg, setMsg, run }
}
