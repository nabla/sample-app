# Nabla Core API Sample App

An example integration for the [Nabla Core API](https://docs.nabla.com), showing an
end-to-end medical encounter: stream audio for live transcription, generate a
clinical note, then derive normalized FHIR data and patient instructions from it.

---

## Quick Start

### 0. Prerequisites

- Node.js v24+
- A Nabla Core API account ([contact us](mailto:api@nabla.com) to create one)

### 1. Clone, install, and run the Sample App

```bash
git clone git@github.com:nabla/sample-app.git
cd sample-app
npm install
npm run dev
```

### 2. Explore the app

If it didn't open automatically, navigate to http://localhost:5173/onboarding.html and
follow the configuration steps.

The home page links the **Full Encounter Demo** and a set of **in-depth guides** that showcase
individual endpoints with live WebSocket message inspection and annotated code.

The backend stores the keypair, config, and tokens under `.cache/`. To start over, delete that
folder.


### 3. Explore the code

The project is split into two parts:

| Folder | What it is |
|--------|------------|
| `frontend/` | The reference UI — Vite + TypeScript + Tailwind. This is the code you're meant to read. |
| `backend/` | A tiny Express server that stands in for **your** auth backend: it holds the OAuth client key, mints tokens, and provisions a user. |

The backend exists so the sample is realistic: in production, token minting and user
provisioning belong on a server you control, not in the browser. You can read it in a few
minutes (`backend/src/auth.ts`).

To explore the codebase, start with `frontend/src/pages/full-encounter-demo/encounter.ts` —
the entrypoint to the full encounter demo. It's a thin orchestrator that wires the per-step
modules (`setup`, `record`, `work-on-note`) together; each step keeps its controller and DOM
rendering side by side.

For focused, single-endpoint walkthroughs — with live WebSocket message inspection and
annotated code snippets — see the in-depth pages under `frontend/src/pages/in-depth/`.

## API version

This sample targets a specific API version, pinned in `frontend/src/api/version.ts` and
`backend/src/version.ts`.

## Further reading

**API docs:** <https://docs.nabla.com>
