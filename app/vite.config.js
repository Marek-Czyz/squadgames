import react from '@vitejs/plugin-react'
import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { defineConfig } from 'vite'

const SECRETS_DIR = resolve(process.env.SECRETS_DIR || join(import.meta.dirname, '..', 'Secrets'))

/** Compiles ../Secrets into `out`; returns { ok, log }. */
function compileSecrets(out) {
  const r = spawnSync(process.execPath, ['scripts/build-secrets.mjs'], {
    cwd: import.meta.dirname,
    env: { ...process.env, SECRETS_DIR, SECRETS_OUT: out },
    encoding: 'utf8',
  })
  return { ok: r.status === 0, log: `${r.stdout}${r.stderr}`.trim() }
}

/** Dev only: recompile the secrets module whenever a file in the Secrets folder is saved. */
function watchSecrets(out) {
  return {
    name: 'watch-secrets',
    apply: 'serve',
    configureServer(server) {
      server.watcher.add(SECRETS_DIR)
      server.watcher.on('all', (_event, file) => {
        if (!resolve(file).startsWith(SECRETS_DIR)) return
        const { ok, log } = compileSecrets(out)
        if (ok) server.config.logger.info(`[secrets] ${file} changed - recompiled\n${log}`, { timestamp: true })
        else server.config.logger.error(`[secrets] compile failed:\n${log}`, { timestamp: true })
        // the generated module changes -> Vite reloads the page by itself
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Emulator mode (local tests) gets its own compiled secrets, so it never touches the real dev server's
  const out = join(import.meta.dirname, 'src', 'generated', mode === 'emulator' ? 'secrets.emulator.js' : 'secrets.js')
  if (mode === 'emulator') {
    const { log } = compileSecrets(out)
    console.log(log)
  }
  return {
    plugins: [react(), watchSecrets(out)],
    resolve: { alias: [{ find: /^\.\.\/generated\/secrets\.js$/, replacement: out }] },
  }
})
