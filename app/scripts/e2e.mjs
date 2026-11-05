// End-to-end smoke test against the Firebase emulators.
// Prereqs: `npm run emulators`, and the test server started with the fixture secrets:
//   SECRETS_DIR=scripts/e2e-secrets npx vite --mode emulator --port 5174
// Usage: APP_URL=http://localhost:5174 node scripts/e2e.mjs [screenshotDir]
import { chromium } from 'playwright-core'

const URL = process.env.APP_URL || 'http://localhost:5174'
const shots = process.argv[2]
const email = `team${Date.now()}@test.local`

const browser = await chromium.launch({ channel: 'msedge' })
const context = await browser.newContext({ viewport: { width: 1280, height: 860 } })
const page = await context.newPage()
const shot = (name, p = page) => shots && p.screenshot({ path: `${shots}/${name}.png`, fullPage: true })
const expectCredit = async (n, p = page) => {
  await p.waitForFunction((v) => document.querySelector('.credit-value')?.textContent === String(v), n, { timeout: 5000 })
  console.log(`  credit = ${n} fc`)
}
const step = (s) => console.log(`- ${s}`)
const assert = (ok, what) => { if (!ok) throw new Error(what) }

// The emulator accepts "Bearer owner" as an admin credential that bypasses security rules
const FS = 'http://127.0.0.1:8085/v1/projects/demo-squad-games/databases/(default)/documents'
async function makeAdmin(mail) {
  const headers = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }
  const { documents = [] } = await (await fetch(`${FS}/teams`, { headers })).json()
  const team = documents.find((d) => d.fields.email?.stringValue === mail)
  if (!team) throw new Error('team doc not found for admin setup')
  const uid = team.name.split('/').pop()
  await fetch(`${FS}/admins/${uid}`, { method: 'PATCH', headers, body: JSON.stringify({ fields: { email: { stringValue: mail } } }) })
}

async function openPost(name) {
  if (await page.getByRole('button', { name: '← Back' }).count()) await page.getByRole('button', { name: '← Back' }).click()
  await page.getByRole('button', { name }).click()
}

async function login(mail, password) {
  await page.getByRole('button', { name: 'Leader login' }).click()
  await page.getByText('Already have an account? Log in').click()
  await page.getByLabel('E-mail').fill(mail)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
}

/** Host panel: press a team's +/- button once and wait for the post total to show `total`. */
async function press(teamName, label, total) {
  const row = page.locator('.host-table tr', { hasText: teamName })
  await row.getByRole('button', { name: label }).click()
  await row.getByText(`${total > 0 ? '+' : ''}${total} fc`, { exact: true }).waitFor()
}

const HOST = { email: `host${Date.now()}@test.local`, password: 'hostpass1' }

try {
  // Start from an empty emulator so leftovers of an aborted run cannot interfere
  await fetch('http://127.0.0.1:8085/emulator/v1/projects/demo-squad-games/databases/(default)/documents', { method: 'DELETE' })
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-squad-games/accounts', { method: 'DELETE' })

  await page.goto(URL)
  await page.getByRole('heading', { name: 'Scoreboard' }).waitFor() // public, before login
  await shot('01-login')

  step('sign up + create team')
  assert(!(await page.getByLabel('E-mail').count()), 'landing page shows no login form')
  await page.getByRole('button', { name: 'Leader login' }).click()
  await page.getByRole('heading', { name: 'Create team account' }).waitFor() // opens on sign-up
  await shot('01b-leader-login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Password').fill('secret123')
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.getByLabel('Team name').fill('The Resistors')
  await page.getByRole('button', { name: 'Start the game' }).click()
  await page.getByText('Choose your post').waitFor()
  await expectCredit(100)
  await page.locator('.scoreboard tr.me', { hasText: 'The Resistors' }).waitFor()
  await shot('02-menu')

  step('post 1: wrong guess, hint, time, then correct guess after cooldown')
  await openPost(/What is this/)
  await page.getByText('No fc loss for a wrong answer.').waitFor()
  await page.getByLabel('Your guess').fill('banana')
  await page.getByRole('button', { name: 'Guess' }).click()
  await page.getByText('Incorrect, next guess in:').waitFor()
  await page.getByRole('button', { name: /Buy hint/ }).click()
  await page.getByText('It measures things').waitFor()
  await expectCredit(90)
  await page.getByRole('button', { name: /Buy time/ }).click()
  await expectCredit(85)
  console.log('  waiting for the 59 s cooldown...')
  await page.getByText('Incorrect, next guess in:').waitFor({ state: 'detached', timeout: 70000 })
  await page.getByLabel('Your guess').fill('  Multimeter ')
  await page.getByRole('button', { name: 'Guess' }).click()
  await page.getByText('Solved! You earned').waitFor()
  await expectCredit(135)

  step('posts 2, 4, 5: rules only, no code field')
  await openPost(/The art of engineering/)
  await page.getByText('+10 fc reward for each member (max 50 fc).').waitFor()
  await page.getByText('No fc from this post yet.').waitFor()
  assert(!(await page.getByLabel('Code').count()), 'no code field any more')
  await shot('03-post2-team')

  step('post 3: question, number riddles')
  await openPost(/Knowledge is king/)
  await page.getByText('Buy a question or a riddle to reveal it, then answer it. Correct answer = doubled amount back.').waitFor()
  await page.locator('.quiz-card', { hasText: 'Question 1' }).click()
  await page.getByRole('button', { name: 'Yes' }).click()
  await expectCredit(132)
  await page.locator('.option', { hasText: 'Option C' }).click()
  await page.getByRole('button', { name: 'Submit answer' }).click()
  await page.getByRole('heading', { name: 'Correct!' }).waitFor()
  await page.getByRole('button', { name: 'OK' }).click()
  await expectCredit(138)
  await page.locator('.quiz-card', { hasText: 'Riddle 5' }).click()
  await page.getByRole('button', { name: 'Yes' }).click()
  await page.getByLabel('The answer is a number').fill('13')
  await page.getByRole('button', { name: 'Submit answer' }).click()
  await page.getByRole('heading', { name: 'Wrong answer' }).waitFor()
  await page.getByRole('button', { name: 'OK' }).click()
  await expectCredit(88)
  await page.locator('.quiz-card', { hasText: 'Riddle 6' }).click()
  await page.getByRole('button', { name: 'Yes' }).click()
  await page.getByLabel('The answer is a number').fill('14')
  await page.getByRole('button', { name: 'Submit answer' }).click()
  await page.getByRole('heading', { name: 'Correct!' }).waitFor()
  await page.getByRole('button', { name: 'OK' }).click()
  await expectCredit(148)

  step('post 3: Game Master riddles R1 + R2 are bought and wait for a verdict')
  await page.locator('.quiz-card', { hasText: 'Riddle 1' }).click()
  await page.getByRole('button', { name: 'Yes' }).click()
  await page.getByText('Answer to this riddle is not a number. Tell your answer to the Game Master').waitFor()
  await page.getByRole('button', { name: 'OK' }).click()
  await expectCredit(138)
  await page.locator('.quiz-card', { hasText: 'Riddle 2' }).click()
  await page.getByRole('button', { name: 'Yes' }).click()
  await page.getByRole('button', { name: 'OK' }).click()
  await expectCredit(123)
  await page.locator('.quiz-card', { hasText: 'Riddle 1' }).getByText('Waiting for Game Master').waitFor()

  step('admin judges R1 correct and R2 incorrect; the team sees it live in another tab')
  await makeAdmin(email)
  const teamTab = await context.newPage() // same login, stays on post 3
  await teamTab.goto(URL)
  await teamTab.getByRole('button', { name: /Knowledge is king/ }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Admin' }).click()
  await page.getByRole('button', { name: /^▸ The Resistors/ }).click()
  await page.locator('.mini-card.judge', { hasText: 'R1' }).click()
  await page.getByRole('button', { name: 'Grant reward' }).click()
  await expectCredit(143)
  await teamTab.getByRole('heading', { name: 'Correct!' }).waitFor()
  await teamTab.getByRole('button', { name: 'OK' }).click()
  await page.locator('.mini-card.judge', { hasText: 'R2' }).click()
  await page.getByRole('button', { name: 'Incorrect' }).click()
  await teamTab.getByRole('heading', { name: 'Wrong answer' }).waitFor()
  await expectCredit(143)
  await teamTab.close()

  step('admin adds a host (admin stays logged in)')
  await page.getByLabel('Host e-mail').fill(HOST.email)
  await page.getByLabel(/^Password/).fill(HOST.password)
  await page.getByRole('button', { name: 'Add host' }).click()
  await page.getByText(`Host ${HOST.email} created.`).waitFor()
  await page.locator('.panel', { hasText: 'Hosts' }).getByRole('cell', { name: HOST.email }).waitFor()
  await page.getByRole('heading', { name: 'Game control' }).waitFor() // still the admin
  await shot('04-admin-hosts')

  step('admin uses the host panel too')
  await page.getByRole('button', { name: 'Host', exact: true }).click()
  await press('The Resistors', '+10 fc for The Resistors', 10)
  await expectCredit(153)

  step('host logs in: no team setup, only the host panel')
  await page.getByRole('button', { name: 'Log out' }).click()
  await login(HOST.email, HOST.password)
  await page.getByText(`Host · ${HOST.email}`).waitFor()
  assert(!(await page.getByText('Welcome, new team!').count()), 'host must not be asked for a team')
  assert(!(await page.getByRole('button', { name: 'Admin' }).count()), 'host has no admin access')
  for (const total of [20, 30, 40, 50]) await press('The Resistors', '+10 fc for The Resistors', total)
  assert(await page.getByRole('button', { name: '+10 fc for The Resistors' }).isDisabled(), 'post 2 max is 50')
  await press('The Resistors', '-10 fc for The Resistors', 40)
  await shot('05-host-post2')
  await page.getByRole('tab', { name: /Show it, not tell it/ }).click()
  await press('The Resistors', '-5 fc for The Resistors', -5) // allowed from 0: teams can lose at post 4
  for (const total of [0, 5, 10]) await press('The Resistors', '+5 fc for The Resistors', total)
  await page.getByRole('tab', { name: /Tic-Tac-Run/ }).click()
  await press('The Resistors', '-5 fc for The Resistors', -5)
  await shot('06-host-post5')
  await page.locator('.scoreboard tr', { hasText: 'The Resistors' }).getByText('188').waitFor()

  step('team sees the host points')
  await page.getByRole('button', { name: 'Log out' }).click()
  await login(email, 'secret123')
  await expectCredit(188)
  await page.locator('.post-card', { hasText: 'The art of engineering' }).getByText('+40 fc').waitFor()
  await openPost(/The art of engineering/)
  await page.getByText('You gained at this post: +40 fc').waitFor()
  await openPost(/Tic-Tac-Run/)
  await page.getByText('You gained at this post: -5 fc').waitFor()
  await shot('07-team-post5')

  step('admin sees host awards in the team details')
  await page.getByRole('button', { name: 'Admin' }).click()
  await page.getByRole('button', { name: /^▸ The Resistors/ }).click()
  await page.locator('.team-details').getByText('+40 fc').waitFor()
  await page.locator('.team-details').getByText(`by ${HOST.email}`).first().waitFor()
  await shot('08-admin-team')

  step('scoreboard follows the credit')
  await page.getByRole('button', { name: '← Back' }).click()
  await page.locator('.scoreboard tr.me', { hasText: '188' }).waitFor()

  step('admin: "Reset my game" keeps admin rights and hosts untouched')
  await page.getByRole('button', { name: 'Admin' }).click()
  await page.getByRole('button', { name: 'Reset my game' }).click()
  await page.getByText('admin rights, host accounts and all logins stay unchanged').waitFor()
  await page.getByRole('button', { name: 'Yes, reset' }).click()
  await expectCredit(100)
  await page.reload() // roles are re-read from the database
  await page.getByRole('button', { name: 'Admin' }).click()
  await page.locator('.panel', { hasText: 'Hosts' }).getByRole('cell', { name: HOST.email }).waitFor()
  await page.getByRole('button', { name: 'Host', exact: true }).click()
  await page.getByRole('tab', { name: /Show it, not tell it/ }).click()
  await page.locator('.host-table tr', { hasText: 'The Resistors' }).getByText('0 fc', { exact: true }).waitFor()

  step('admin: "Reset this team", then remove the team (asks for the exact team name)')
  await page.getByRole('button', { name: 'Admin' }).click()
  await page.getByRole('button', { name: /^▸ The Resistors/ }).click()
  await page.getByRole('button', { name: 'Reset this team' }).click()
  await page.getByRole('button', { name: 'Yes, reset' }).click()
  await expectCredit(100)
  await page.getByRole('button', { name: 'Remove team The Resistors' }).click()
  await page.getByText('Are you sure you want to remove The Resistors?').waitFor()
  const confirmDelete = page.locator('.modal').getByRole('button', { name: 'Yes, remove team' })
  assert(await confirmDelete.isDisabled(), 'remove must be disabled until the name is typed')
  await page.getByLabel(/Type the team name/).fill('The Resistor')
  assert(await confirmDelete.isDisabled(), 'remove must stay disabled for a wrong name')
  await shot('09-remove-team')
  await page.getByLabel(/Type the team name/).fill('The Resistors')
  await confirmDelete.click()
  await page.getByText('Welcome, new team!').waitFor()
  await page.getByLabel('Team name').fill('The Capacitors')
  await page.getByRole('button', { name: 'Start the game' }).click()
  await expectCredit(100)
  assert(await page.getByRole('button', { name: 'Admin' }).count(), 'admin rights survive removing own team')

  step('signed out: public scoreboard lists the new team, not the deleted one')
  await page.getByRole('button', { name: 'Log out' }).click()
  await page.locator('.scoreboard', { hasText: 'The Capacitors' }).waitFor()
  assert(!(await page.locator('.scoreboard', { hasText: 'The Resistors' }).count()), 'deleted team must leave the scoreboard')
  await shot('10-public-scoreboard')

  step('mobile layout')
  await page.setViewportSize({ width: 390, height: 844 })
  await shot('11-mobile-login')

  console.log('\nE2E PASSED')
} catch (err) {
  await shot('zz-failure')
  console.error('\nE2E FAILED:', err.message)
  process.exitCode = 1
} finally {
  await browser.close()
}
