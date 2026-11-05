# Ada

Ada turns a topic into a durable personal course, then teaches and assesses one activity at a time. The sidebar contains courses, rather than conversations. This repository implements the supplied `ADA_CODEX_BUILD_SPEC.md` with Next.js, TypeScript, Supabase and a server-side OpenAI adapter.

**Delivery status:** locally verified application and HTTP learning journeys. Live Supabase/email integration, real-model quality, visual browser QA and production deployment have **not** been verified in the supplied environment. See `IMPLEMENTATION_STATUS.md` for the exact limits. Local test content is deliberately generic, visibly labeled and never represents subject-specific AI teaching.

## Requirements

Node 22+ and npm. The lockfile pins the installed dependency graph. Production also needs a Supabase project (Auth + PostgreSQL), email delivery enabled, and an OpenAI key with access to structured-output models. Do not put privileged keys in a `NEXT_PUBLIC_` variable.

## Start a local development preview

```bash
npm ci
cp .env.example .env.local
```

For a single-learner **development fixture** without accounts or external services, set these values in `.env.local`:

```dotenv
ADA_DEV_AUTH=true
MOCK_MODEL=true
APP_BASE_URL=http://localhost:3000
```

Then run `npm run dev` and open `http://localhost:3000/app`. A banner identifies both local authentication and the fake model. File-backed state is saved in `work/data`, survives restarts and is excluded from Git/source archives. Stop the server and remove `work/data` to reset this preview. Do not expose this mode to other users. Production rejects either development flag being enabled.

To try **real AI with local persistence**, use `ADA_DEV_AUTH=true`, `MOCK_MODEL=false`, and configure `OPENAI_API_KEY`. Configure `ADA_MODEL_CLARIFY`, `ADA_MODEL_COMPILE`, `ADA_MODEL_TUTOR` and `ADA_MODEL_EVALUATE` with supported structured-output model IDs; defaults are `gpt-4.1-mini`.

## Configure real authentication and persistence

1. Create a Supabase development project. Apply `supabase/migrations/202611040001_learner_state.sql` in its SQL editor, or link this directory with the Supabase CLI and run `supabase db push`. This migration is applied once, not on application startup.
2. In Supabase Auth, enable email magic-link sign-in. Set the site URL to your app origin and add `http://localhost:3000/auth/callback` and the deployment callback URL to the redirect allowlist. Configure SMTP for production delivery.
3. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, **server-only** `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` and `APP_BASE_URL` in `.env.local`. Set `ADA_DEV_AUTH=false` and `MOCK_MODEL=false`.
4. Run `npm run dev`. Use your email to sign in. The server exchanges the callback code, checks the user with `auth.getUser()` for every request and uses HttpOnly session cookies. Production cookies are secure.
5. Run the two-account authorization checks below before deploying. The supplied environment had no credentials, so these checks are not represented as passed.

All database records sit in a versioned learner aggregate. RLS is enabled; **anon and authenticated roles have no table access** because the aggregate contains private grading keys. Only the server service role can read it. The server derives the owner ID from verified authentication and scopes every query to it. The compare-and-swap RPC is executable only by the service role. The authenticated self-deletion function uses `auth.uid()` and takes no target user ID. See `DECISIONS.md` for the storage tradeoff.

## What works

- Empty course-first sidebar and responsive home prompt; desktop sidebar/mobile drawer.
- Persistent one-question setup, free-text and quick replies, start-now defaults, editable intake and validated provisional graph.
- Atomic, retry-safe draft conversion; independent curiosity and goal courses.
- One current activity per course, with explanation, radio multiple choice, free response and ungraded reflection.
- Structured, topic-specific generation through the real provider adapter; no fixed topic curricula.
- Private answer keys, server grading, hints and alternate explanations with assistance attribution.
- Debounced versioned answer saves, local unsaved-response recovery, exact saved activity resume, pause and feedback-before-continue.
- Immutable assessment records, conservative concept statuses, prerequisite-aware next activities and due recall selection.
- Goal revisions retaining evidence and concept identity; adaptive outline and evidence-oriented progress.
- Per-user AI request caps, bounded provider retries/timeouts/output tokens, validation and safe plain-text rendering.
- Profile/time-zone settings, data export, confirmed course deletion and self-service account deletion.
- No reminder delivery or enrollment. No arbitrary code execution, retrieval, generated HTML or fabricated citations.

## API

The application uses a compact command API in place of many repeated REST handlers:

- `GET /api/v1/state`: authenticated learner-safe state and development mode labels.
- `POST /api/v1/command`: validated domain command; see `commandSchema` in `src/lib/service.ts`.
- `POST /api/v1/login`: email magic link (pre-authentication).
- `POST /api/v1/logout`: revoke current auth session.
- `GET /api/v1/export`: learner-safe JSON export; does not reveal unanswered grading keys.
- `POST /api/v1/delete-account`: delete the authenticated account and cascade learner state.

Commands use `{action, resource?, activityId?, text?, version?, key?, intent?, timezone?}`. `key` is a UUID retry receipt. Course creation and grading also have intrinsic duplicate guards. `saveAnswer` requires the current answer version. All current-activity commands require that activity's ID, preventing stale tabs from acting on another activity. Draft answers accept a revision. A conflicting write returns 409; refresh saved state before retrying. Mutation requests require JSON and the configured same Origin, with a 24 KB request limit. The server returns a stable error envelope with request ID and retryability.

Model responses are Zod-validated, including unique concept slugs and an acyclic prerequisite graph. Output repair is bounded to two attempts; SDK transient retries are bounded to one, with a 25-second timeout per SDK request. Maximum completion tokens: 4,000 for curriculum, 2,500 otherwise. Requests are capped at 12 AI-consuming commands per minute and 100 per UTC day per learner. These are request/output ceilings, not a precise dollar budget; actual provider costs depend on the model. No raw learner text is logged. Unsaved answer recovery keeps a versioned draft in this browser’s local storage; course/account deletion and sign-out clear the relevant cached answers.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Vitest covers graph validity, mastery/independence, review intervals, private DTOs, retry-safe creation/attempts, exact resume, unauthorized course IDs, deletion, optimistic concurrency, goal history, provider failure and stale tabs. Playwright's default suite runs full **HTTP** learner journeys against a temporary Next development server using local fixtures; no external API keys or browser installation are required. It stops that server afterward. The test-only burst allowance is enabled exclusively for the development server.

Browser cases are supplied separately but were **not run** in this environment because no supported browser-control runtime was available. On a machine with Playwright browsers, enable them with:

```bash
ADA_BROWSER_TESTS=true npm run test:e2e
```

The tests preserve no real user credentials. The default HTTP tests use the shared local fixture learner and remove courses they create; do not point them at production.

### Live integration acceptance checks (not yet executed)

- Create two real users. Sign in as A, create a course and record its ID. As B, attempt every mutation for A's course: all must return 404. Direct anon/user-JWT table reads and `save_learner_state` calls must be denied. A should still resume the same saved activity after signing out/in.
- Delete a course and verify it and its draft, activities, evidence and reviews disappear while another course remains. Export must not contain private answer fields.
- Create an expendable real user, delete that account through settings and verify its auth user and `learner_states` row are gone.
- With real models, create courses for train wheels, black holes, Python spreadsheet automation, and an unseen niche topic. Verify distinct curricula, sound questions, factual quality, and uncertainty. Inspect network responses to confirm no private grading key is returned.
- Force a provider timeout, verify saved answers survive, retry proposal without duplicate conversion, and retry evaluation without duplicate evidence.
- Test keyboard-only, mobile drawer, focus trapping, offline recovery, and meaningful feedback manually or through the supplied browser suite. No visual screenshot was produced in this environment.

## Deploy

Use Vercel or a Node-compatible host. Configure all production environment variables, apply the migration to the intended production Supabase project, configure Auth callback URLs, and run `npm run build`. Start with `npm start` on Node hosts. Terminate TLS at the host and retain HTTPS; `APP_BASE_URL` must exactly match the public origin. Never enable development authentication or a fake model in production. Production persistence uses Supabase, not the host filesystem.

This is a Node application and is **not** packaged as a Cloudflare Sites Worker. It has not been published. Complete the live integration acceptance checks before inviting learners; a successful compilation does not verify provider credentials, email delivery, RLS behavior or educational quality.

## Data and limitations

Assessment evidence is append-only through the domain service. Status requires two distinct independent successful questions, including one difficulty 2+; no proficiency comes from exposure or reflection. Reviews use 1, 3, 7, 14 and 30 day intervals for independent successful recall; assistance/incorrect answers reset to a day. Curiosity has no completion percentage. Readiness is provisional and deliberately withheld if the outline is under-assessed.

Aggregate documents simplify atomicity but cap a learner's data at 5 MB and create per-learner write contention. Normalized relational tables, scalable pagination, per-course monetary budgets and usage accounting should precede wider deployment. Current course sessions are resumable singleton checkpoints, not a separate historical sessions table. Sources/retrieval, branch editing, user-selected concept study, notifications/quiet hours, telemetry opt-in and sandboxed coding are not implemented. LLM grading is fallible and requires real-world calibration.
