# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Halda** — a hackathon demo (HITLAB World Cup) of an AI college guide for high-school sophomores. Next.js 15 App Router + TypeScript + Tailwind 3 + framer-motion. Two pages only: `/` (the whole student experience) and `/partner` (the university lead console). It's a demo, so reliability-on-stage trumps generality.

## Commands

```bash
pnpm dev                 # dev server on :3000 (port is hardcoded via -p 3000)
pnpm build               # production build
pnpm demo                # rm -rf .next && build && start — use this for the live demo (clean cache avoids stale-.next errors)
node_modules/.bin/tsc --noEmit   # type-check (run from the halda/ dir). This is the de-facto test — there is no test framework.
node --env-file=.env.local scripts/test-gemini-live.mjs   # verify Gemini Live actually streams audio back
node scripts/fetch-rmp.mjs   # refresh cached RateMyProfessor school ratings → lib/ratings.data.ts (run occasionally, NOT at request time)
node --env-file=.env.local scripts/fetch-scorecard.mjs   # refresh cached College Scorecard data (real acceptance/net price/earnings for schools beyond the seeded 17) → lib/scorecard.data.ts
```

There are **no unit tests**. Verification is `tsc --noEmit` + driving the running app. When changing tailwind.config.ts, **restart the dev server** — Tailwind config changes are not reliably hot-reloaded.

## Environment

`.env.local` holds `GEMINI_API_KEY` and `NEXT_PUBLIC_GEMINI_API_KEY` (the latter is exposed client-side because the browser Live API needs it). Models are overridable: `GEMINI_TEXT_MODEL` (default `gemini-3.1-flash-lite`), `NEXT_PUBLIC_GEMINI_LIVE_MODEL` (default `gemini-3.1-flash-live-preview`). The app degrades gracefully with no key (deterministic engine fallback), so most things still run.

## Architecture — the big picture

The **`StudentProfile`** (`lib/types.ts`) is the spine. Everything reads/writes it: chat, voice, the editable UI, matching, and the partner marketplace. Understand it first.

**Data flow:** student talks (text or voice) → Gemini agent tool-calls extract structured data → one client context (`useHalda`) merges it into the profile → that drives matches / credit fit / tasks live, and syncs to the server store so the partner console sees the same student.

### The agent brain (`lib/halda-agent.ts`, `app/api/gemini/route.ts`)
Gemini **function-calling** with four tools: `update_profile` (extracts every fact incl. AP/dual-enrollment credits), `search_universities` (reveals ranked matches when it has enough), `find_scholarships` (profile-matched aid via `lib/scholarships.ts`), `add_task` (puts real deadlines like FAFSA on the list). `runAgent` runs the tool loop server-side and returns `{reply, updates, tasks, revealMatches, toolEvents}`. `toolEvents` are surfaced as **tool-call chips in the chat** (rendered by `Conversation.tsx` when a `ChatMessage.tool` is set) so the agent's actions are visible — they're filtered out of the model history.
- **Gotcha (Gemini 3):** when echoing a `functionCall` back into the conversation you MUST preserve its **thought signature** — push `res.candidates[0].content`, never a reconstruction, or the API 400s.
- The agent is told the profile's completeness % each turn so it knows when to stop interrogating and search.
- `lib/agent.ts` is a separate **deterministic** slot-filling engine used as the never-fails fallback (and for the SMS channel via `app/api/chat/route.ts`). `lib/halda-prompt.ts` holds the persona + the `ProfileUpdates` shape.

### Client state (`lib/useHalda.tsx`)
One React context owns the profile, chat transcript (shared by text AND voice), gamification, and persistence.
- **Gotcha:** multiple `setProfile` calls in a single agent turn clobber each other because they each read a stale `profileRef.current`. `applyUpdates` therefore folds profile updates + new tasks + match-reveal into **one** `setProfile`. Keep new agent-turn side-effects inside `applyUpdates`, don't add parallel setters.
- Persists the profile to `localStorage` (resume an unfinished session) and fires `sync()` → `POST /api/students` so the partner console reflects the live student.
- Manual editing (`editField`, `upsertInterestSignal`, `upsertCredit`, task toggles) lives here too.

### Voice (`lib/useGeminiLive.ts`, `components/VoiceMode.tsx`)
Gemini Live over WebSocket. Mic → PCM16 @16kHz → `sendRealtimeInput`; received 24kHz PCM is queued and played. Final transcripts call `ingestVoiceUser` → the SAME `/api/gemini` (mode `extract`) → `applyUpdates`. So **voice and text share one brain and one transcript**; voice can also add tasks / reveal matches. Mic capture fails gracefully (the receive path still works without a mic).

### Matching — the core product idea
Match a student's **interests + intent** to schools where that interest becomes a path, backed by evidence. Read these together:
- `lib/interests.ts` — interest categories, intent classification (career/major/serious/community/fan/hobby), per-intent evidence lenses.
- `lib/interest-match.ts` — the headline scorer. A **6-factor weighted blend** (academic / interest / affordability / scholarship / credit / family) that **re-weights for cost-sensitive students** and for "must-have at all costs" interests. If a student named only a major, it's treated as an implied "major" interest so the lens still fires.
- `lib/credit.ts` — the **Credit Wallet** lens (`creditTransferFit`): per-school AP/dual-enrollment policies; measures *usable* credit, not "more = better." Includes the pre-med caution (don't skip core science with AP where it would actually count).
- `lib/evidence.ts` — grounded evidence badges per school (generated, honestly confidence-rated).
- `lib/ratings.ts` + `lib/ratings.data.ts` — **real RateMyProfessor school-level ratings** (overall + 11 categories + review count), fetched once by `scripts/fetch-rmp.mjs` and cached in `ratings.data.ts` (the app never calls RMP live). Read via `ratingFor(id)`; also attached to each match (`InterestAlignedSchoolScore.rating`) and served by `GET /api/schools`. **Unofficial endpoint / against RMP ToS — demo-only; swap the cache for a licensed feed in production (the `ratingFor` shape stays).** A couple of schools are pinned by RMP node id in the script because RMP's search hides their flagship campus.
- `lib/match.ts` (baseline score), `lib/schools.ts` (17 seeded schools, incl. 3 in Utah), `lib/geo.ts` (distance), `lib/deadlines.ts` (FAFSA/PSAT date resolver computed from grade).
- **`stayInState`** preference: when the student wants to stay close to home, `scoreInterestFit` boosts same-state schools (+6) and penalizes out-of-state ones (−26) so the list honors it. The agent sets it via `update_profile` (and saves `state`).

### Multi-tenant store (`lib/store.ts`)
In-memory `globalThis` singleton. Students live in a tenant-agnostic namespace; schools (tenants) **only ever see masked `Lead`s** until purchase, which freezes a consent-gated snapshot. **All tenant access goes through `withTenant(slug)`**, which throws on a missing/unknown tenant — that's the isolation guarantee (→ 403 in the route). Don't add a code path that reads tenant data without it.
- **Gotcha:** `next dev` HMR can reset the `globalThis` store mid-session. `POST /api/demo/seed` re-seeds known-good state; `pnpm demo` (production start) avoids the reset entirely.

## Conventions

- **Brand tokens** are CSS variables in `app/globals.css` (cream/pine/coral/gold). Gold is reserved for earned rewards only.
- **Numeric font weights** (`font-700`, `font-600`, `font-500`) are declared in `tailwind.config.ts` under `fontWeight` — they are NOT default Tailwind utilities. If you use a new numeric weight, add it there or it silently emits no CSS.
- Path alias: `@/*` → repo root.
- There is **no presenter/demo mode** — it's a live demo the user drives by talking. The profile starts empty (`freshMaya()` in `useHalda`) and fills as the conversation goes. `reset()` (the "Start over" button on `/`) clears it for the next run.
