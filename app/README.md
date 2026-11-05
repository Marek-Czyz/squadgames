# The Squad Games – web app

React (Vite) + Firebase Auth (e-mail/password) + Firestore + Firebase Hosting.

## How the secrets work

Everything in `../Secrets` is compiled into `src/generated/secrets.js` by
`scripts/build-secrets.mjs`. This runs automatically before `npm run dev` and `npm run build`,
and it prints a warning for anything that is missing or still a placeholder.

| File (`.ini`, `.ini.txt` or `.txt`) | Content |
|---|---|
| `post1`        | accepted names of the item, one per line (`answer = ...` or just the word) |
| `hint1`        | hints in the order they are sold, one per line |
| `questions.ini`| `[Q1]..[Q6]`, `[R1]..[R6]` with `price`, `text` (`\n` = new line), `A`..`D`, and for riddles optionally `check = host \| number \| text` (default: R1–R4 `host` = judged by the Game Master in the admin panel, R5–R6 `number`) |
| `answers.ini`  | `answer = C`, `answer = B,D` (select all that apply), `answer = 14 \| fourteen`, or `keywords = a, b` |

Matching ignores case, punctuation and extra spaces. Answers and passwords are stored only as
salted hashes. Hints and question texts are obfuscated, so they are not readable in the bundle.
**After you change anything in Secrets, rebuild and redeploy.**

## One-time Firebase setup

1. Create a project at <https://console.firebase.google.com> (the free Spark plan is enough).
2. **Authentication → Sign-in method →** enable *Email/Password*.
3. **Firestore Database →** create the database (production mode; the app's rules get deployed).
4. **Project settings → Your apps →** add a *Web app*, then copy the config values into
   `.env.local` (template: `.env.example`).
5. Put your project id in `.firebaserc`, then run `npx firebase login` once.

## Commands

```bash
npm install
npm run deploy          # build + deploy hosting and Firestore rules
npm run dev             # local dev server against the real Firebase project
npm test                # unit tests (secrets compiler + answer checking)
```

Team accounts: teams can sign up on the login screen. Alternatively, create the accounts yourself
under *Authentication → Users* and set `VITE_ALLOW_SIGNUP=false`. On first login a team is asked
for its name and gets 100 fc. Data lives in `teams/{uid}`, and every fc change is logged in
`teams/{uid}/log`. Hosts can see both in the Firestore console.

## Scoreboard

The collection `scoreboard/{uid}` holds only team name and credit and is readable by everyone
(it is shown on the login page and the main menu). The security rules only accept an entry that
matches the team's own data, so a team cannot fake its score there.

## Hosts (posts 2, 4, 5)

Hosts are listed in `hosts/{uid}` and can only be added by an admin (Admin → Hosts). A host login
gets no team: it only sees the **Award fc** panel – choose post 2, 4 or 5 and press −/+ next to a
team (post 2: ±10 fc, max 50 per team; post 4: ±5 fc, max +50 and no lower limit (teams can lose); post 5: ±5 fc, between −25 and +25).
Admins reach the same panel with the **Host** button. Resetting or removing teams never touches the admin or host lists. The security rules let hosts change only a
team's credit and host points. Every press is logged with the host's e-mail.

## Admin

Admins are listed in the Firestore collection `admins/{uid}`. Only the project owner can add one
(Firebase console → Firestore → `admins` → add a document whose ID is the user's UID from
Authentication → Users). An admin sees an **Admin** button in the header, which opens:

- **Reset my game** – back to 100 fc, everything hidden or unsolved, log cleared (team name kept)
- **Reset all teams** – the same for every team. Use it right before the real game starts.
- **Loaded from Secrets** – what the running build contains (counts and ok/missing, no answers)
- **Hosts** – add a host (e-mail + password, the admin stays logged in) or remove the host role.
- **Teams** – click a team for its progress per post. Riddles waiting for the Game Master show a pulsing **judge** badge: click it, then ✓ (grant reward) or ✗ (incorrect). The team sees the verdict live.

Testing .ini files: keep `npm run dev` running. Saving a file in `Secrets` recompiles the secrets
and reloads the page. Then use *Reset my game* and play it through. The live site only gets the
new files after `npm run deploy`.

`npm run test:rules` tests the Firestore security rules in the emulator.

## Local testing without a Firebase project

```bash
npm run emulators                                   # terminal 1 (needs Java)
SECRETS_DIR=scripts/e2e-secrets npm run secrets     # test secrets instead of the real ones
npx vite --mode emulator                            # terminal 2
node scripts/e2e.mjs                                # full browser run-through (uses Edge)
npm run secrets                                     # switch back to the real secrets!
```

## Security note

All game logic runs in the browser. A technically skilled player with devtools could inspect
the obfuscated content or write to their own team's credit. (The rules stop them touching other
teams.) To make it cheat-proof, move the checks to Cloud Functions; that needs the Blaze plan.
