# The Squad Games

A team game in five posts, with a web app for scores, quiz cards and host rewards.
Live at **https://www.squadgames.tech**.

- `app/` – the web app (React + Firebase). See [app/README.md](app/README.md) for setup, testing and deployment.
- `The_Squad_Games*.pptx / .pdf` – the game rules presentations.
- `Assets/` – logo and background artwork.
- `App_description.txt` – the app requirements.

The quiz questions, answers and hints live in a local `Secrets/` folder that is **not** part of this
repository. The app compiles them at build time (`app/scripts/build-secrets.mjs`).
