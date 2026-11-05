# Ada implementation status

Delivered against `ADA_CODEX_BUILD_SPEC.md`, version 1.0. This report distinguishes implemented code, locally verified behavior and checks that require external services. **P0 is not certified complete for production.**

## Verified checks

| Check                                  | Result                                                     |
| -------------------------------------- | ---------------------------------------------------------- |
| TypeScript strict check                | Passed                                                     |
| ESLint                                 | Passed                                                     |
| Vitest                                 | 19 tests passed, 3 files                                   |
| Playwright HTTP learner journeys       | 3 passed                                                   |
| Playwright browser journeys            | 2 authored, skipped; supported browser runtime unavailable |
| Next production build                  | Passed                                                     |
| Live Supabase migration/RLS/Auth/email | Not run; no credentials supplied                           |
| Live OpenAI educational smoke tests    | Not run; no API key supplied                               |
| Visual/mobile/keyboard browser QA      | Not run                                                    |
| Deployment                             | Not performed                                              |

## Slice 0 — Bootstrap

- [x] Inspected empty Git repository and selected the requested default stack.
- [x] Next.js routes, strict TypeScript, shell, responsive styles and empty home/sidebar.
- [x] Supabase magic-link sign-in/callback/sign-out implementation with HttpOnly cookies.
- [x] Reproducible PostgreSQL migration, RLS, server-only access and self-deletion function.
- [x] Environment example, lockfile, dev/build/lint/typecheck/test/test:e2e scripts.
- [x] Explicit development fixture auth and persistence, refused in production.
- [ ] Real sign-in and migration verified against Supabase.
- [ ] Screenshot/browser verification (no supported browser runtime available).

Primary files: `package.json`, `src/app`, `src/lib/auth.ts`, `src/lib/store.ts`, `supabase/migrations`, `README.md`.

## Slice 1 — Course creation

- [x] Persistent drafts and one-question setup with quick/free-text answers.
- [x] Start-now defaults, proposal, adjust and retry states.
- [x] Server-side OpenAI structured model adapter; bounded retries, token limits and schema validation.
- [x] Validated arbitrary-topic graph compilation; duplicate/cyclic/missing-reference rejection.
- [x] Atomic/idempotent conversion to one durable course and sidebar entry.
- [x] Curiosity and goal fixture journeys coexist without cross-course context.
- [x] Failed provider call preserves intake answers; retry does not duplicate the answer.
- [ ] Real-model train-wheels/black-holes/Python/niche-topic smoke tests.

Primary files: `src/lib/schema.ts`, `src/lib/model.ts`, `src/lib/service.ts`, `src/components/ada.tsx`. Local domain and HTTP curiosity/goal paths passed.

## Slice 2 — Course workspace

- [x] Learn/Outline/Progress destinations, course title and direction.
- [x] Safe explanation/multiple-choice/free-response/reflection components.
- [x] Private grading fields filtered from all learner state and exports.
- [x] Adaptable outline, prerequisite labels and evidence detail disclosure.
- [x] One persistent current activity, with activity history retained.
- [ ] User-selected concept study action and independently addressable historical session entities.

Primary files: `src/components/ada.tsx`, `src/app/globals.css`, learner DTO functions in `src/lib/schema.ts`.

## Slice 3 — Learning loop

- [x] Server-side deterministic MC and rubric-model free-response grading.
- [x] Hint/alternate explanation, assistance attribution and ungraded reflection.
- [x] Append-only evidence, feedback-before-next and misconception teaching.
- [x] Conservative proficiency requires two different independent successful questions, one at difficulty 2+.
- [x] Versioned autosave, local unsaved-response recovery, pause and exact saved activity resume.
- [x] Retry-safe submissions and compare-and-swap write conflicts.
- [x] Expected activity ID prevents stale-tab answers/help/advance affecting a different activity.
- [x] Provider-adapter tests cover structured parsing, repair bounds, invalid graphs and missing credentials.
- [ ] Real rubric grading calibrated for factual/educational quality.

Primary files: `src/lib/learning.ts`, `src/lib/service.ts`, `tests/learning.test.ts`, `tests/service.test.ts`, `tests/model.test.ts`.

## Slice 4 — Retention and goal revision

- [x] Persisted 1/3/7/14/30-day recall intervals and due review selection.
- [x] Reviews use the existing activity flow; due queue has a useful empty state.
- [x] Versioned goal/intent revision, curriculum history, preserved concept identities/evidence.
- [x] Goal readiness bands with under-assessment disclosure; curiosity has no completion percentage.
- [x] Settings/time-zone display; reminders explicitly off with no delivery jobs.
- [ ] User-driven branches, syllabus edits, targeted study and postpone controls.

Primary files: `src/lib/learning.ts`, `src/lib/service.ts`, course/review/settings views in `src/components/ada.tsx`.

## Slice 5 — Hardening and delivery

- [x] Authenticated owner-scoped domain operations, request validation and same-origin mutation checks.
- [x] Server-only private database and model keys, safe React text rendering, no code execution.
- [x] Persisted per-learner request ceilings, bounded output/timeout/retry policy.
- [x] Loading/errors/retry, mobile drawer, accessible radios, keyboard answer submission, modal focus trap and reduced motion.
- [x] Rename/confirmed cascading course deletion, filtered export and implemented self-service account deletion.
- [x] HTTP security/journey tests, unit/domain/model tests, production build and deployment guide.
- [x] Source archive excludes local learner data, environment secrets, dependencies and build output.
- [ ] Live two-account authorization/RLS/account-deletion tests.
- [ ] Browser accessibility/mobile/offline QA and real-model smoke tests.
- [ ] Operational telemetry pipeline, per-course dollar accounting, retention policies and production deployment.

## Material implementation differences

- Uses one versioned PostgreSQL JSONB learner aggregate instead of the suggested normalized table set. All learning transitions save atomically with CAS. Private teacher data requires server-only access; RLS denies direct learner/anon table access. Aggregate size is capped at 5 MB, and concurrent writes within a learner can return 409. This needs normalization/pagination before larger scale.
- Uses a validated authenticated command endpoint instead of the suggested REST endpoint collection. All domain ownership and retry contracts live in the service layer.
- Course sessions use a singleton resumable checkpoint plus activity history. No separate historical sessions table or adaptive curriculum branch editor.
- No retrieval: content is AI-labeled and URLs/bibliographies are not generated. No reminder jobs, external notifications, telemetry collection or code sandbox.
- Local fake lessons are generic interface fixtures, never hardcoded subject curricula presented as AI. Real provider paths exist but have not been exercised with credentials.
- Next's default TypeScript CLI-output parser failed in this environment; the documented compiler API checker is enabled and production build/typecheck pass.

## Next acceptance step

Configure an actual Supabase development project and OpenAI key following `README.md`; execute the migration, two-account isolation/deletion checks, real-model smoke tests and browser cases. Resolve those observations before treating P0 as production-ready. No permission or credential values are embedded in the source deliverable.

## Sign-in delivery diagnostics follow-up

Email sign-in now distinguishes provider rate limits, restricted recipients and disabled email providers. Other delivery failures direct the operator to Supabase Auth/SMTP logs. Vercel logs contain only a request ID, bounded provider error code and numeric status; provider messages, addresses and credentials are never logged. Rate limits return HTTP 429. Three regression tests cover these cases (22 unit/domain/model tests in total). Live SMTP remains unverified.
