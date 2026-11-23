# AI Math Comics

Interactive math comics for grades 5–6 in Russian and Kazakh. Students read a comic, solve the
exercise on the story panel with help from Pifik's hints, and unlock the ending. The app includes
the six-chapter season “Operation: School Fair”, AI-generated comics, and classroom assignments
that teachers can write and publish.

## Run locally

- For the catalog and a simulated generator, run `npm ci` and `npm run dev` from `frontend/`.
- For real generation and classroom accounts, follow the [backend setup](backend/README.md) to
  configure a provider and start FastAPI and its standalone worker. Then run `npm run dev:live`
  from `frontend/`. Open [the app](http://localhost:5173).
- For a pilot deployment, see the [deployment guide](docs/pilot-deployment.md) and
  [account migrations](docs/account-migrations.md).

## Classroom workflow

1. Register or sign in as a teacher, create a class, and share its class code.
2. Open **Создать авторский комикс** in the teacher dashboard. Generate a draft with My Story,
   edit the six panels in Russian and Kazakh, and set the boss problem and two Pifik hints.
3. Choose the class and publish. Students who joined with the class code see the assignment on
   the route map. The teacher's class report shows completion and which hints students opened.

See the [classroom walkthrough](frontend/README.md#classroom-assignments) for the full flow.

## Project docs

- [Frontend](frontend/README.md): React + TypeScript + Tailwind reader, catalog, My Comics, and the
  Create Comic flow.
- [Backend](backend/README.md): FastAPI API and generation worker (Gemini or OpenAI, prepared or
  live artwork).
- [API contract](docs/api-contract.md)
- [Roadmap](docs/ROADMAP.md): what is done, in progress, and planned.
- [AGENTS.md](AGENTS.md): setup, checks, rules and current state for coding agents (Codex,
  Claude Code). Everything lives in this one folder on `main`.
