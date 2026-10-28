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
