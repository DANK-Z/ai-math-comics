# AI Math Comics

Interactive math comics for grades 5–6 in Russian and Kazakh. Students read a comic, solve the
exercise on the story panel with help from Pifik's hints, and unlock the ending. The app includes
the six-chapter season “Operation: School Fair” and AI-generated comics.

## Project docs

- [Frontend](frontend/README.md): React + TypeScript + Tailwind reader, catalog, My Comics, and the
  Create Comic flow.
- [Backend](backend/README.md): FastAPI API and generation worker (Gemini or OpenAI, prepared or
  live artwork).
- [API contract](docs/api-contract.md)
- [Roadmap](docs/ROADMAP.md): what is done, in progress, and planned.
- [AGENTS.md](AGENTS.md): setup, checks, rules and current state for coding agents (Codex,
  Claude Code). Everything lives in this one folder on `main`.
