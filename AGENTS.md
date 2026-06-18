# AGENTS.md

Guidance for Codex when working in this repository.

## Rules

- Never run Prettier, `npx prettier`, or any script/formatter flow that invokes Prettier.
- Keep changes small and demo-reliable. This is a hackathon project: the stage path matters more than generality.
- Do not stage, commit, push, amend, or update PRs unless the user explicitly asks for that exact git action.
- Do not do browser/manual QA unless the user specifically asks. Use code inspection and type-checking, then suggest browser QA when useful.

## What this is

**Halda** is a Next.js 15 App Router demo of an AI college guide plus university lead console. The current repo is more than the original two-page prototype:

- `/` is the mobile-style student app shell: home, explore, profile, connect, cohort, and the AI guide sheet.
- `/partner` is the university lead console with tenant switching and lead purchase.
- `/simulator` is a data-driven simulator using JSON students/colleges from `lib/data`.
- `app/api/*` contains Gemini chat/extraction, deterministic chat, SMS link/webhook, student lookup/sync, school data, suggestions, evaluation, demo seeding, and tenant lead routes.
- `backend/` is a separate Express bridge for Surge SMS plus email providers; it calls the Next app through `HALDA_URL`.

## Commands

```bash
pnpm dev                         # clean .next, then next dev on :3000
pnpm build                       # production build
pnpm demo                        # clean .next, build, then start on :3000
node_modules/.bin/tsc --noEmit   # de-facto verification; there is no test framework
node --env-file=.env.local scripts/test-gemini-live.mjs
node scripts/fetch-rmp.mjs
node --env-file=.env.local scripts/fetch-scorecard.mjs
```

`pnpm dev` and `pnpm demo` delete `.next`; that is intentional for demo reliability. Restart the dev server after changing `tailwind.config.ts`.

## Environment

`.env.local` holds `GEMINI_API_KEY` and `NEXT_PUBLIC_GEMINI_API_KEY`. The public key is intentional because the browser Gemini Live path needs it. Model overrides:

- `GEMINI_TEXT_MODEL` defaults to `gemini-3.1-flash-lite`.
- `NEXT_PUBLIC_GEMINI_LIVE_MODEL` defaults to `gemini-3.1-flash-live-preview`.

The app has deterministic fallbacks, but `/api/gemini` itself returns 500 without `GEMINI_API_KEY`.

## Core map

- `lib/types.ts`: domain spine. `StudentProfile` drives chat, voice, matching, credit wallet, gamification, consent, and partner leads.
- `lib/useHalda.tsx`: single client state hub. Owns profile, transcript, localStorage, gamification, match reveal, manual edits, task/credit mutations, and sync to `POST /api/students`.
- `lib/halda-agent.ts` + `app/api/gemini/route.ts`: Gemini function-calling agent. Tools include profile updates, school search, school detail, web lookup, scholarships, and task creation.
- `lib/agent.ts` + `app/api/chat/route.ts`: deterministic fallback and SMS/server chat path.
- `lib/useGeminiLive.ts` + `components/app/VoiceView.tsx`: browser Gemini Live audio. Final voice transcripts feed back into the same profile update path.
- `lib/interest-match.ts`, `lib/credit.ts`, `lib/evidence.ts`, `lib/match.ts`: ranking, Credit Wallet, evidence badges, and baseline fit.
- `lib/schools.ts`, `lib/ratings.data.ts`, `lib/scorecard.data.ts`, `lib/scholarships.data.ts`: cached demo data. Do not fetch live data at request time.
- `lib/store.ts`: in-memory `globalThis` store for students, cross-channel lookup, transcript history, tenants, and masked leads.

## Important behavior

- Keep agent-turn side effects inside `applyUpdates` in `lib/useHalda.tsx`. Multiple parallel `setProfile` calls can clobber each other because they read stale `profileRef.current`.
- Gemini 3 function calling needs thought signatures preserved when echoing a `functionCall`. In `runAgent`, push `res.candidates[0].content`; do not reconstruct it.
- Tool-call chips are visible chat messages, but filtered out of model history.
- Voice, web chat, SMS, and email should converge on one student profile and shared store/history when linked.
- `withTenant(slug)` in `lib/store.ts` is the only door for school-visible lead data. Do not add tenant reads that bypass it.
- A purchased lead freezes a consent-gated snapshot; schools do not receive live access to the student profile.
- `next dev` HMR can reset the in-memory store. `POST /api/demo/seed` re-seeds known-good state; `pnpm demo` avoids most reset surprises.

## UI and style conventions

- Brand tokens live in `app/globals.css`; the app-specific mobile shell styles are in `app/halda-app.css`; simulator styles are in `app/simulator/simulator.css`.
- Numeric font weights like `font-700`, `font-600`, and `font-500` are custom Tailwind utilities declared in `tailwind.config.ts`.
- Path alias is `@/*` to the repo root.
- Use existing app components under `components/app/*` for student-shell work; older broad components such as `Conversation.tsx`, `CreditWallet.tsx`, and `EditableProfile.tsx` still exist and may be unused or legacy.
- Gold is reserved for earned rewards.

## Data refresh scripts

- `scripts/fetch-rmp.mjs` refreshes cached RateMyProfessor school ratings into `lib/ratings.data.ts`. It uses an unofficial endpoint and is demo-only.
- `scripts/fetch-scorecard.mjs` refreshes College Scorecard cache into `lib/scorecard.data.ts`.
- `scripts/fetch-school-media.mjs` refreshes public school media assets.
- Persona/golden scenario scripts exist for demo checking, but there is no formal unit test suite.
