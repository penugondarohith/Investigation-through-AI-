# AI Mystery Room

An interactive fictional mystery investigation app. Users create a case, inspect generated evidence, make one accusation, and then see the server-validated solution.

## Requirements

- Node.js 20+
- MongoDB (local or hosted)
- Google Gemini API key for mystery generation

## Run locally

1. Copy `.env.example` to `.env` and set `MONGODB_URI`, `GEMINI_API_KEY`, and a strong `SESSION_SECRET`.
2. Install dependencies with `npm install`.
3. Start both apps with `npm run dev`.
4. Open `http://localhost:5173`.

The API runs on port 5000. Generated content is fictional. The backend stores canonical truth privately and omits it from all pre-accusation responses. Image and CCTV evidence are represented as labeled text/simulations until a media provider is configured.

## Production deployment

The frontend and Express API are separate applications. Deploy `client/` to Vercel as a Vite site and deploy `server/` to a Node.js host that supports a long-running Express service. A static Vercel frontend alone does not provide the `/api/*` backend routes.

Configure these server environment variables on the backend host:

- `MONGODB_URI`: MongoDB connection string.
- `GEMINI_API_KEY`: Google Gemini API key.
- `SESSION_SECRET`: random secret with at least 24 characters.
- `CLIENT_URL`: exact HTTPS origin of the deployed frontend (no trailing slash).
- `NODE_ENV=production`.

Set `VITE_API_URL` in Vercel to the backend origin, for example `https://your-api-host.example.com` (origin only, no `/api`). Redeploy the frontend after setting it. The backend enables credentialed CORS for `CLIENT_URL`; production session cookies require HTTPS. `client/.env.example` documents the frontend setting. For local development, leave `VITE_API_URL` blank so the Vite proxy continues to forward `/api` to `localhost:5000`.

## Project layout

- `client/`: React, Vite, TypeScript application.
- `server/`: Express API, MongoDB persistence, Gemini generation and validation.
- `spec.md`: Product and engineering source specification.

## Main API

- `POST /api/mysteries` creates a validated generation job and returns its ID.
- `GET /api/mysteries/:id` returns the safe public case.
- `POST /api/mysteries/:id/evidence/:evidenceId/discover` persists evidence discovery.
- `POST /api/mysteries/:id/accusations` submits a single final accusation.
- `GET /api/mysteries/:id/results` returns the solution only after accusation.

Generation requires a working Gemini API key and MongoDB connection. Failed or invalid generations are marked failed and are not playable.

## Evidence room

The investigation view includes searchable, filterable fictional evidence records, relationship links, a document-style viewer, chat transcripts, simulated CCTV frames, and clearly labeled illustrative scene artwork. Discovery timestamps and progress are saved in the existing MongoDB Attempt collection. The added timestamp array has a default value, so no database migration is required for existing cases. No new environment variables or media provider are required; image evidence is presented as a generated-style illustration and never as authentic forensic photography.

## Suspect interrogation

Each generated suspect has a private, bounded knowledge profile (direct facts, beliefs, hearsay, unrelated secrets, and unknowns), personality, and established statements. Interrogation turns are stored per suspect in the existing MongoDB `Attempt` record. Only discovered evidence can be presented. The dialogue endpoint is owner-session scoped and never returns private knowledge or culprit flags. Gemini dialogue requires the existing `GEMINI_API_KEY`; invalid output falls back to a bounded in-character response. No new environment variables or migration are required.

Run the focused dialogue safety tests with `npm --workspace server test`. They cover non-culprit confession rejection, source citation checks, contradiction mapping, knowledge limits, personality tone, and safe projection of persisted conversation state.

Open a dedicated interview at `/mystery/:id/interrogation/:suspectId` from a suspect's case page. It supports natural-language questions, presenting discovered evidence, persistent private notes, contradiction/disclosure indicators, and optional AI follow-up, statement-review, and evidence-comparison actions. Assistance is owner scoped, rate limited, and receives public suspect details and discovered evidence only. Long chats send the last eight turns plus a bounded persisted summary. It uses the existing `GEMINI_API_KEY`; no new configuration or migration is needed.

## Investigation board

Each case has an interactive board at `/mystery/:id/board`. It creates nodes and established links from the case's actual suspects, evidence, referenced locations, and timeline. Players can move and connect nodes, add theories/questions/notes, assess and group items, search/filter, zoom/pan, undo/redo, and request optional AI suggestions. The board is saved on the existing MongoDB `Attempt` record and scoped to the case owner. The board API validates node and link references and regenerates official links from case data; player links and accepted AI suggestions remain visibly separate. AI analysis uses the existing `GEMINI_API_KEY`, only includes discovered evidence, and returns suggestions with evidence citations. No extra package, environment variable, or migration is needed.

The board is built with React and SVG rather than an external graph library. Automated coverage currently exercises backend board validation and AI citation checks, but does not include browser-driven pointer/touch interaction or a live Gemini integration test.

## Evidence-based final verdict

The final accusation opens a structured verdict form. Players choose a suspect, explain motive/method/alibi, order known timeline events, classify discovered evidence, and give a reasoning statement. The server requires at least `VERDICT_MIN_REASONING_CHARS` characters (default `60`, allowed `20`–`1000`) and only accepts evidence discovered in that attempt. The transparent rubric is versioned in `server/src/verdict-logic.ts`: culprit 25, motive 15, method 15, timeline 15, evidence 20, reasoning/contradictions 10. Objective suspect, event, and evidence checks plus the server's weighted calculation determine the total. Gemini assesses free-text answers and writes feedback at temperature zero; invalid output or provider errors fall back to deterministic text/evidence checks. The saved verdict includes the submission, scores, timestamp, case version, and rubric version. The full solution is only returned after a final verdict is accepted. No migration or additional package is needed; the reasoning minimum is the only new optional environment setting.
