# Ada — Codex Build Specification

**Version:** 1.0 • **Date:** 2026-11-04 • **Status:** Implementation handoff for a responsive web MVP  
**Product name:** Ada  
**Tagline:** *Ada teaches what no one bothered to make a course for.*  
**Product source:** `Ada_Concept_Architecture_Roadmap.md` (v0.3, Oct 29, 2026) and subsequent course-first desktop design decisions.  
**Priority:** Working, model-powered learning loop > polish or feature breadth.

---

## 0. Instructions to Codex (read first)

Build a functioning web application, not a static mockup. Start by inspecting the existing repository. If a compatible app exists, extend its stack instead of replacing it blindly; otherwise use the default stack in §12. Implement vertical slices in the sequence in §20. Run checks and tests at each slice. Maintain a `IMPLEMENTATION_STATUS.md` checklist with completed, partial, and blocked work, and record deviations/decisions in `DECISIONS.md`. Do not claim a feature is finished when it is only mocked.

**Nonnegotiable outcomes:** A user can sign in, type an arbitrary topic, answer conversational clarification questions, create a persistent **course**, take a dynamically generated interactive lesson, submit an answer, receive feedback, have assessment evidence stored, resume on another visit, and revisit a concept from a review queue. The left sidebar lists **courses, not chats**. Course identity survives lessons, goal changes, and new model calls. A learner can create both a curiosity course and a concrete-outcome course.

Implement genuine backend endpoints, persistence, server-side AI calls, request validation, authorization, migrations, tests, and clear configuration. Do not hardcode the train-wheels and Python lessons as if generated. A deterministic local fake model is allowed **only for development/tests** and must be visibly labeled as such. Never ship a browser-side model API key, evaluate raw model-generated code in the main app, or send notifications without opt-in.

If the repository is empty, create a `README.md`, `.env.example`, reproducible migrations, seed/test fixtures, and scripts for `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`. Document what credentials are needed and how to run locally. Prefer functional simplicity to elaborate agent frameworks.

---

## 1. Product definition

Ada is a proactive, personalized learning coach that instantly creates a course about almost any topic. A course is a **durable user-owned object** with an objective or curiosity theme, evolving curriculum, lesson sessions, assessment evidence, retention state, and recommended next action. The content is generated and adapted rather than pre-authored.

A new user initially sees a nearly empty screen with the centered prompt **“What would you like to learn?”** and one input. Submitting a topic enters a brief conversational course-creation flow. Ada asks **one clarifying question at a time**, only when needed to select scope, depth, goals, starting level, and time budget. A user who says “I’m just curious” is not forced to invent a performance objective. Once sufficient, Ada proposes a modest starting plan, creates the course, and starts the first lesson quickly.

The main shell and left sidebar persist. After course creation, sidebar entries are course names (e.g., “Black holes,” “Chess,” “Python for spreadsheets”). They are **not chat transcripts**. Selecting a course opens its persistent learning workspace. The primary content should be focused and uncluttered, with optional curriculum/progress views. Ada coaches across courses and can later send permissioned reminders.

### 1.1 Two learning intents, one UX

- **Goal-driven:** “Learn chess so I can beat my casual-playing friends.” Ada clarifies an observable outcome and estimates readiness using evidenced skills, not lesson completion. If the goal changes to tournament chess, preserve skill history and recalculate readiness relative to the new objective.
- **Curiosity-driven:** “I want to understand black holes.” Ada maps explored ideas, unresolved questions and intriguing branches; there is no dishonest 100%-complete metric for an open-ended subject.

These are different *intent attributes on the same course model*, not separate products or elaborate onboarding flows. Users can transition a course between intents without losing history.

### 1.2 Product principles

1. **Course-first:** Courses replace chats as the navigation, persistence, and personalization unit.
2. **Start with one prompt:** Minimize onboarding friction and screen chrome.
3. **One obvious action:** Avoid busy dashboards, tables of metrics, and decorative controls.
4. **Teach, don’t just explain:** Assess → Teach → Test → Update → Schedule.
5. **Generate the journey:** Structure and evidence persist; explanations, examples, and activities are generated on demand.
6. **Evidence before progress:** Proficiency is not a completion meter, streak, or model compliment.
7. **Warm but not juvenile:** Ada is a capable coach, not a gamified school portal.
8. **Clear agency:** Pause, correct, branch, change goals, and turn reminders off.

---

## 2. Initial delivery scope

### P0: End-to-end MVP (required)

- Email sign-in via supported auth provider (Google optional), persisted user profile.
- Minimal responsive app shell with desktop sidebar, course list, user menu.
- Home prompt; create-course conversation with 1 question at a time; skip/answer; resume unfinished draft.
- Arbitrary subject input; intent classification (curiosity / goal), basic personalization, dynamic curriculum compilation.
- Creation of durable course, initial concept nodes with prerequisite relationships, estimated first activities.
- Course workspace with **Learn**, **Outline**, **Progress** as understated tabs or links; focus defaults to Learn.
- Generated lesson flow using prebuilt `explanation`, `multiple_choice`, `free_response`, `reflection` components; hint and “explain differently.”
- Answer submission with evaluation and feedback; assisted vs independent attempt distinction.
- Persistent sessions/drafts with exact resume; course history and revised goals.
- Simple competency statuses; next-action planner; due review queue and spaced recall.
- Loading, empty, error, offline/retry, course deletion, and graceful AI failure states.
- Source references / uncertainty for factual statements where retrieval is enabled; never hallucinate URLs.
- Unit, API, and at least two end-to-end journey tests.

### P1: After vertical slice is reliable

- Opt-in email or in-app reminders; aggregated user-level nudges with quiet hours and unsubscribe controls.
- Richer graph visualization; course branching; adaptive difficulty, syllabus edits, goal recalculation explanation.
- Optional source-grounded research/retrieval for obscure and changing subjects, stronger verification.
- Code exercises executed through a separately isolated sandbox; never evaluate submitted Python/JS in the Next.js server process.
- Learning analytics and mentor-coach recommendations across courses.

### Out of scope for P0

Payments, native apps, voice, video, desktop observation, browser extension, graph database, external credentials, formal certification, course marketplace, public sharing, arbitrary model-generated components/scripts, multi-agent microservices, continuously running agents, aggressive streak mechanics. Code execution is deliberately **not** required for P0; Python can initially use conceptual examples, then P1 adds executable assessment.

---

## 3. UX contract and screen specifications

### 3.1 Desktop design language

Desktop-first responsive web app, mobile-friendly. White / near-white background, understated charcoal text, **one restrained purple accent**, high readability, generous whitespace, soft borders, few shadows. No decorative hero illustrations, card grids, KPI dashboards, giant progress rings, or simultaneous forms. Content max width ~780–880px for lessons; sidebar ~240px desktop, collapsible on narrow screens; generous line spacing. Use a modern system/sans font. Support light mode first; avoid motion that obscures reading. WCAG-oriented contrast, accessible keyboard interactions, labeled controls, focus visibility, reduced motion.

**Persistent sidebar:** Ada wordmark; `+ New course`; divider; scrollable course names with active-state highlight; user/settings at bottom. Optionally show one subtle due-review dot, never numerous independent badges. No “Chats,” separate “Projects,” or “My Lessons” navigation tree. On a brand-new account, sidebar can show an empty `Your courses will appear here` note; do not populate sample courses as actual user data.

### 3.2 Home (`/app`)

Center a headline **“What would you like to learn?”** and a single prominent prompt input with send icon/Enter behavior. Sidebar course list remains visible. Optional below-input subdued example placeholders can rotate or be a single line, but no clutter. Returning users can see at most one **“Pick up where you left off”** unobtrusive row below the prompt, not a card-heavy dashboard. The same prompt always starts a **new course**. Existing courses are reached through sidebar.

### 3.3 Course setup (`/app/new?draft=...`)

After submit, transition to a calm conversational sequence. First Ada response should acknowledge the specific topic and ask **one** best next question. Examples:

- Topic “chess” → “What would you like to be able to do with chess?” Quick answers: “Beat casual friends,” “Play competitively,” “Just explore.”
- Topic “black holes” → “Are you mostly curious, or aiming for a specific level of understanding?” “Just curious” starts quickly.
- Topic “train wheels” → “Would you like a quick explanation or a deeper exploration?”

Follow-up questions adapt to previous responses and only ask fields that affect curriculum. Desired goal, baseline, time budget, depth, deadline are possible fields but **not a mandatory multi-field intake form**. In P0 limit to ~2–4 questions; permit “Let Ada decide” / “Start now.” Persist the draft after each answer; browser refresh resumes. Show current answers as a simple, subtle conversation, not a long chat history. “Back” can edit prior answers and invalidate/recompile dependent draft state. At a sufficient point Ada displays:

- Course name and one-sentence objective / exploration purpose.
- Compact `Your starting path` with ~3–6 provisional concepts and an approximate suggested cadence (no false mastery date).
- `Start course` as primary button, `Adjust` secondary.

Course generation must be genuinely model-driven for arbitrary topics and bounded by validation and fallback. Failures should preserve answers and enable retry; avoid duplicate courses on repeated submits.

### 3.4 Course Learn (`/app/courses/[courseId]`)

Sidebar highlights the course. Top of main panel: course title; small context line with goal or curiosity intention; simple `Learn | Outline | Progress` tabs, goal editing in a small menu. The **Learn** view focuses on **one teaching activity** at a time. Present Ada’s prompt/content with readable typography and a fitting interactive control. Below is a contextual answer input or options and actions. Keep a single primary `Check answer` / `Continue` button. Show `Hint`, `Explain differently`, `Skip` in a quiet secondary row when relevant. Submitting an answer visibly updates feedback and then a “Continue” action; do not advance automatically before feedback is understood. Course conversational help is contextual to the current activity, not a parallel unbounded chat thread. Allow Pause and resume with saved draft.

### 3.5 Course Outline (`/app/courses/[courseId]/outline`)

Simple hierarchical list of provisional concepts with indentation/prerequisites and one status per concept: `Not assessed`, `Developing`, `Demonstrated`, `Review due`. Click concept to open a small detail panel: “what you’ll learn,” evidence (if any), and `Study this` if available. Clearly label outline as adaptable. A knowledge map graph can replace/augment list in P1; P0 list is preferred to avoid scope creep. Curiosity branches attach as nodes in same course.

### 3.6 Course Progress (`/app/courses/[courseId]/progress`)

Separate **learning evidence** from **activity counts**. For goal courses, show `Estimated readiness for: [goal]` with plain-language band `Early / Developing / Approaching / Demonstrated` and explanation of which independently demonstrated competencies informed that estimate; label as estimate, not qualification. Prefer band over fake 42% precision in P0. Show `What you can do`, `Needs more practice`, `Due to revisit` as concise text sections. For curiosity courses, show breadth/depth of explored concepts, recent demonstrated explanations, outstanding questions, and suggested branches; **no percent-to-completion**. If little evidence exists, say `Not enough evidence yet`.

### 3.7 Review (`/app/review` optional destination or inline course activity)

Reviews are retrievable activities linked to an existing course and concept. A minimal view can select next due item and take the learner into the same lesson component system. Reassessment occurs only when learner answers (not when reminder is sent). Consider review as a type of course activity rather than a distinct top-level product area. If there is no due review, a clear empty state.

### 3.8 User settings (`/app/settings`)

Profile, time zone, reminder preferences, quiet hours (P1), delete account/export request guidance, AI-data-use disclosure. User can delete a course with explicit confirmation; delete must cascade or securely remove associated learner data. Account deletion request process should be documented and functional, not a dummy control.

### 3.9 Responsive behavior

Desktop sidebar visible. Under 768px collapse to drawer/hamburger, preserve main prompt and lesson focus. Touch targets >=44px, avoid sideways content scroll. Keyboard: Enter submits inputs, Shift+Enter adds newline for multi-line answers, Escape closes dialogs, focus moves sensibly after activity transitions. Loading states do not destroy unsaved input.

---

## 4. Core domain model and invariants

### 4.1 Terminology

- **Course:** durable top-level object owned by learner, not a chat.
- **Course draft:** pre-creation clarifying flow and model-produced proposal.
- **Goal:** versioned statement of intent, baseline, desired outcome, success criteria, time preferences.
- **Concept:** skill, idea, or competency unit in a course graph; has prerequisites and evidence criteria.
- **Session:** an attempt to learn/review within a course, consisting of activities.
- **Activity:** one rendered explanation, multiple-choice question, free response, or reflection.
- **Attempt:** learner response to an assessable activity, with assistance and grading metadata.
- **Evidence:** immutable assessment record tied to attempt, rubric, concept, evaluator, and timestamp.
- **Mastery state:** derived summary/status from evidence; can be recomputed.
- **Review item:** next due recall/retrieval practice for a concept.
- **Course coach:** persistent state + orchestrator policy scoped to a course; **not** a dedicated always-on LLM.
- **Global Ada coach:** cross-course prioritizer, user-level preferences, nudge budget.

### 4.2 Invariants

1. Every course and dependent record belongs to exactly one user; authorization enforced server-side for every read/write.
2. A course retains identity across all sessions; editing a goal creates a new `goal_version`, never deletes evidence.
3. Deleting a course removes/invalidates related sessions, concepts, attempts, reviews, summaries, and scheduled notifications.
4. Model outputs are untrusted proposals parsed against strict schemas; never directly database-applied without validation.
5. Evidence is append-only or audit-versioned. Derived statuses may be recalculated without changing original responses.
6. Lesson completion does not establish proficiency. Hints/answer reveals reduce independence attribution.
7. A new page reload resumes the same in-progress activity and saved answer, not a fresh generated question.
8. Exactly-once observable course creation/attempt submission under retries (idempotency).
9. A curiosity course can never show `X% complete of all knowledge`.
10. Reminders require user opt-in; no silent channel enrollment.

---

## 5. Suggested database schema (PostgreSQL)

Use UUID PKs, `created_at`, `updated_at` where relevant; index `owner_id`, `course_id`, `status`, `due_at`. Enforce foreign keys and cascading deletion as appropriate. Implement schema migrations, not runtime ad hoc table creation. Minimal normalized entities:

| Table | Core fields | Notes |
|---|---|---|
| `profiles` | `user_id` PK, `display_name`, `timezone`, `created_at` | Linked to auth user. |
| `course_drafts` | `id`, `owner_id`, `topic`, `state_json`, `turns_json`, `status`, `proposal_json`, `version` | Draft intake; `status`: collecting/ready/converted. |
| `courses` | `id`, `owner_id`, `title`, `topic`, `intent` curiosity/goal, `status`, `active_goal_version_id`, `created_at`, `updated_at`, `last_opened_at` | Sidebar source of truth. |
| `course_goal_versions` | `id`, `course_id`, `version`, `goal_text`, `success_criteria_json`, `time_budget_minutes_weekly`, `baseline_json`, `depth`, `deadline_at`, `reason` | Append on edits. |
| `concepts` | `id`, `course_id`, `slug`, `title`, `description`, `assessment_criteria_json`, `importance`, `status` | Scope to course in P0; graph identity can be shared later. |
| `concept_edges` | `course_id`, `from_concept_id`, `to_concept_id`, `edge_type` | `prerequisite` or `related`; DAG for prerequisites. |
| `course_curriculum_versions` | `id`, `course_id`, `version`, `plan_json`, `reason`, `model_info_json` | Preserve revision trail. |
| `sessions` | `id`, `course_id`, `owner_id`, `kind`, `status`, `started_at`, `ended_at`, `current_activity_id`, `checkpoint_json` | `kind`: lesson/review; `status`: active/paused/completed. |
| `activities` | `id`, `session_id`, `concept_id`, `sequence_no`, `kind`, `spec_json`, `status`, `model_info_json` | Generated data validated by activity schemas. |
| `activity_drafts` | `activity_id`, `owner_id`, `draft_json`, `updated_at` | Durable response input. |
| `attempts` | `id`, `activity_id`, `owner_id`, `submission_json`, `hint_count`, `explanation_revealed`, `idempotency_key`, `submitted_at` | Unique `(owner_id, idempotency_key)`. |
| `assessment_evidence` | `id`, `attempt_id`, `concept_id`, `result`, `score`, `independence`, `rubric_json`, `reason`, `evaluator_json`, `created_at` | `score` optional; evidence record, not perfect truth. |
| `mastery_estimates` | `course_id`, `concept_id`, `status`, `confidence`, `last_independent_success_at`, `last_assessed_at`, `updated_at`, `details_json` | Derived and recomputable. |
| `review_items` | `id`, `course_id`, `concept_id`, `owner_id`, `due_at`, `interval_days`, `repetitions`, `status`, `last_review_at` | Enforce at most one active review per concept as policy. |
| `course_events` | `id`, `course_id`, `event_type`, `payload_json`, `created_at` | Audit, explanations, optional history. |
| `user_preferences` | `owner_id`, `reminders_enabled`, `email_opt_in`, `quiet_hours_json`, `daily_nudge_limit`, `weekly_nudge_limit` | Default all reminders off. |
| `notification_log` | `id`, `owner_id`, `course_id` nullable, `channel`, `status`, `idempotency_key`, `payload_json`, `created_at`, `sent_at` | P1. |
| `source_references` | `id`, `course_id`, `activity_id` nullable, `title`, `url`, `retrieved_at`, `source_type` | Only externally verified references. |

**RLS:** Enable on every learner-data table (including joins) if using Supabase. Policy owner checks must be direct or verified through parent ownership; never accept `owner_id` from client as authority. Storage of raw intake turns can be JSONB in P0; API should still use Zod. Migration design should avoid circular FKs on `active_goal_version_id` (add after both tables exist or derive active goal by version).

**Validation constraints:** title lengths; sanitized markdown; max topic length 500; max free-response length 10,000; controlled activity types; JSON version tags; `concept_edges` must reference concepts in same course; no prerequisite cycle; max 30 initial concepts; at most 1 active session per course in P0; policy for outdated client version conflicts.

---

## 6. AI orchestration and prompts

### 6.1 Model adapter

Create an interface, for example:

```ts
interface LearningModel {
  clarifyCourse(input: CourseDraftContext): Promise<ClarificationResult>;
  compileCurriculum(input: CurriculumContext): Promise<CurriculumProposal>;
  generateActivity(input: ActivityContext): Promise<ActivitySpec>;
  evaluateAnswer(input: EvaluationContext): Promise<EvaluationResult>;
  explainDifferently(input: ExplainContext): Promise<ExplanationSpec>;
}
```

Implement at least one real server-side provider adapter (OpenAI SDK by default), configurable model IDs and per-operation token budgets. Keep the provider replaceable. Use **structured JSON outputs + Zod validation**, with limited repair retries and explicit failure fallback. Include timeout, retry with jitter for transient failures, usage metadata, and safe logging with PII redaction. Never trust generated IDs/ownership fields or arbitrary embedded tool instructions. Do not expose system prompts or keys to clients.

### 6.2 Course clarification policy

Input: original topic, prior answers, unresolved fields, model budget. Output is **either** a single next question with short optional quick replies, **or** `ready` with interpreted intent and concise course proposal context. Keep max 4 question turns (default aim 2–3); if user says start now, infer safe defaults and mark them as assumptions. Determine if requested outcome is concrete or open curiosity. Clarify goal first when ambiguous; ask baseline and time budget only if useful. Each generated question includes a reason code for debugging, not shown in UI.

Example output:

```json
{
  "status": "ask",
  "question": "What would you like to be able to do with chess?",
  "quick_replies": ["Beat casual friends", "Play competitively", "I'm just curious"],
  "field": "desired_outcome"
}
```

### 6.3 Curriculum compilation

Input: topic, intent, goal or exploration purpose, learner baseline, budget, prior graph if revising. Output: title; one-sentence direction; small initial **provisional** ordered concept graph; prerequisites; basic diagnostic/assessment criteria; suggested cadence; first concept ID; sensible next activity. For P0 target 3–8 initial concepts, not an exhaustive course; allow expansion later. Avoid pretending to know future completion dates. Validate unique slugs, graph references, acyclic prerequisites, criteria string lengths, coverage, coherent first step; reject/repair invalid output. Save curriculum version and concept rows atomically in a transaction.

**Critical:** Train wheels / black holes / Python are acceptance fixtures **only**. Normal course generation must work for novel topics like “history of ball bearings in bicycles” without pre-coded topic templates.

### 6.4 Session controller and activity generator

Explicit states:

`idle → choosing_next → presenting → awaiting_response → evaluating → feedback → choosing_next → ... → paused/completed`

Use server-owned transitions, not an LLM deciding directly which DB mutation to perform. Select `next action` using rules that prioritize due review, prerequisites, recent misconceptions, opportunity for transfer, and achievable learner session length. The model creates one **validated activity specification**, not arbitrary HTML. Provide prompt context with course goal, recent relevant evidence, current concept, available time, assistance history, max difficulty, and prior activity summaries. Limit content to the target concept and use natural, encouraging teacher voice.

Example activity union (discriminated by `kind`):

```ts
type ActivitySpec =
  | { version: 1; kind: 'explanation'; conceptId: string; title?: string; bodyMarkdown: string; continueLabel?: string }
  | { version: 1; kind: 'multiple_choice'; conceptId: string; promptMarkdown: string; choices: { id: string; text: string }[]; correctChoiceId: string; rationale: string; difficulty: 1 | 2 | 3 }
  | { version: 1; kind: 'free_response'; conceptId: string; promptMarkdown: string; rubric: { criterion: string; importance: number }[]; idealAnswerPrivate: string; difficulty: 1 | 2 | 3 }
  | { version: 1; kind: 'reflection'; conceptId: string; promptMarkdown: string };
```

**Security:** Client must not receive `correctChoiceId`, `idealAnswerPrivate`, or grading rubric secrets for an unanswered question. Keep teacher-only fields server-side; return a sanitized learner-facing DTO. After submission the evaluation may expose rationale and correction. Markdown rendering must sanitize unsupported HTML and disallow scripts/remote iframe content.

### 6.5 Evaluation and mastery

- Multiple choice: deterministic server-side exact-choice evaluation, with optional explanation generated separately.
- Free response: model-assisted rubric grading may return `correct`, `partial`, `incorrect`, or `uncertain`, with criterion-level reasons. Make uncertainty explicit and avoid confident false precision. Grade against stated criteria; don't use stylistic fluency as proof.
- Reflection/explanation: never automatically counts as skill mastery simply for reading or typing something.
- Hints or solution reveals set independence to `assisted`; only independent and sufficiently challenging successful attempts can advance to `Demonstrated`.
- Record full attempt + evaluation metadata (provider, model, rubric version) atomically. On evaluator errors, mark `pending_evaluation` or retriable; do not lose user submission.

**Conservative P0 status policy:**

- `Not assessed`: no meaningful evidence.
- `Developing`: attempted, assisted correct, partial, or one easy isolated success.
- `Demonstrated`: at least **two independent successful assessments** that are not the identical question, including one at difficulty >= 2 or meaningful transfer example. Set confidence `provisional` until delayed review occurs.
- `Review due`: previously evidenced concept has a due retention check; not automatic forgetting or skill failure.

Store scoring evidence, not just the status. The mapping to readiness band uses coverage of required concepts plus prerequisite bottlenecks; if under-assessed, show `Not enough evidence`. Clearly state estimates and uncertainty. Do not turn lesson count into proficiency percentage.

### 6.6 Review scheduler

After a meaningful attempt, schedule an appropriate recall. P0 simple policy: first review +1 day, then +3, +7, +14, +30 days after independent successful reviews; incorrect review resets or shortens interval, assistance limits expansion. Persist `next_due_at`; use user timezone for presentation. Review questions should test retrieval with a fresh variant rather than repeating the identical original multiple choice. Reading a review notification does not create evidence. User can postpone; no streak penalty.

### 6.7 Source grounding and niche content

In P0, model explanations can be marked as **AI-generated**. For stable general subjects, citations are optional rather than fabricated. If provider web retrieval/search is integrated, only store and render URLs actually returned/verified by that tool; preserve provenance. If information is time-sensitive, technical, medical, legal, or otherwise high stakes, acknowledge uncertainty and do not claim professional certification. Do not synthesize a fake bibliography. Include prompts resisting prompt injection in quoted source text.

### 6.8 Context assembly and memory

Use structured records as source of truth, not an infinite chat transcript. For each model request assemble: course goal/version, intent, learner time budget/baseline, selected concept/prereqs, recent evidence and misconception summaries, prior activity IDs and assistance, due reviews, and explicit pedagogical instruction. Keep under token budget with selective retrieval of relevant evidence; not full user history. Course-specific memories do not automatically bleed into unrelated courses. Global coach can read lightweight course metadata to select one recommended next session.

---

## 7. API contract (authenticated, versioned JSON)

Use Next.js route handlers under `/api/v1` (or compatible server actions with the same tested business contracts). Validate `Content-Type`, Zod request/response types, ownership, and per-user rate limits. Standard error envelope: `{ "error": { "code": "...", "message": "...", "retryable": false }, "requestId": "..." }`. Provide useful codes for auth, validation, conflict, provider timeout, and rate limit. Prefer stable DTO types in `/src/contracts` or `/src/lib/schemas` shared by frontend/backend.

| Method | Route | Behavior |
|---|---|---|
| `GET` | `/api/v1/courses` | User's courses ordered by last opened, with due count/next step; pagination when needed. |
| `POST` | `/api/v1/course-drafts` | Create draft from topic; idempotent by key. |
| `GET` | `/api/v1/course-drafts/:id` | Resume draft and prior questions. |
| `POST` | `/api/v1/course-drafts/:id/answer` | Save answer; run clarification policy; return next question or ready proposal. |
| `POST` | `/api/v1/course-drafts/:id/propose` | Generate/retry curriculum proposal; status ready. |
| `POST` | `/api/v1/course-drafts/:id/convert` | Transactionally create course/goal/graph; idempotent; return course ID. |
| `GET` | `/api/v1/courses/:id` | Course header, active goal, next action, selected session summary. |
| `PATCH` | `/api/v1/courses/:id` | Rename or pause/archive; optimistic version. |
| `DELETE` | `/api/v1/courses/:id` | Explicit deletion with confirmation on UI; cancel pending reviews. |
| `POST` | `/api/v1/courses/:id/goals` | Create goal revision, preserve prior evidence, recalc band. |
| `GET` | `/api/v1/courses/:id/outline` | Concepts, edges, statuses and revision. |
| `GET` | `/api/v1/courses/:id/progress` | Evidence-based status and due list, no fake metrics. |
| `POST` | `/api/v1/courses/:id/sessions` | Resume existing active session or start new lesson/review. |
| `GET` | `/api/v1/sessions/:id` | Current activity, sanitized content, feedback, saved draft, status. |
| `PUT` | `/api/v1/activities/:id/draft` | Save learner input; debounced client, versioned. |
| `POST` | `/api/v1/activities/:id/hint` | Generate hint; record assistance (idempotent). |
| `POST` | `/api/v1/activities/:id/explain` | Alternative explanation; mark assistance. |
| `POST` | `/api/v1/activities/:id/attempts` | Submit answer, grade, persist evidence; idempotent; return feedback. |
| `POST` | `/api/v1/sessions/:id/next` | Advance to next activity after feedback or complete session. |
| `POST` | `/api/v1/sessions/:id/pause` | Pause with exact resume checkpoint. |
| `GET` | `/api/v1/reviews/due` | User's due review items across courses. |
| `GET/PATCH` | `/api/v1/preferences` | Time zone, reminder consents, etc. |

**Concurrency:** Use optimistic versions or transactional row locks for draft state, activity submit and session advance. Duplicate client requests must return the same resource/result. Requests after course deletion return 404 rather than leak existence of other users' records. Retryable provider errors should not half-create lessons or overwrite user responses.

---

## 8. Representative client data shapes

```ts
type CourseListItem = {
  id: string;
  title: string;
  intent: 'curiosity' | 'goal';
  updatedAt: string;
  nextActionLabel: string | null;
  reviewDueCount: number;
};

type CourseDraftView = {
  id: string;
  topic: string;
  turns: { role: 'ada' | 'learner'; text: string }[];
  state: 'collecting' | 'ready' | 'converted';
  nextQuestion?: { text: string; options?: string[]; field: string };
  proposal?: { title: string; direction: string; initialConceptTitles: string[]; suggestedMinutesWeekly?: number };
};

type CourseProgress = {
  courseId: string;
  intent: 'curiosity' | 'goal';
  goalText?: string;
  readiness?: { band: 'unknown' | 'early' | 'developing' | 'approaching' | 'demonstrated'; basis: string; evidenceCount: number };
  concepts: { id: string; title: string; status: 'not_assessed' | 'developing' | 'demonstrated' | 'review_due'; evidenceCount: number }[];
  nextAction: { kind: 'learn' | 'review' | 'explore'; label: string };
};
```

**Design note:** Keep persisted model schemas and client view schemas separate. Never return private answer keys to a learner client before grading. Runtime shape validation is required on AI outputs as well as inbound HTTP.

---

## 9. User flows and exact acceptance scenarios

### Flow A: First curiosity course

1. New signed-in user lands `/app`; sees `What would you like to learn?`, input, minimal sidebar.
2. Enters `Why are train wheels tapered?` and submits.
3. Ada clarifies depth or intent, one question at a time; user chooses `Just curious, five minutes`.
4. Ada proposes a course titled something like `How train wheels work` with initial concepts (taper, wheelset geometry, curves); these are generated for this run.
5. User confirms; course appears in sidebar; opens Learn.
6. Ada asks a prediction or short baseline question; user responds. Feedback explains concept and adapts next step.
7. User pauses mid-session, refreshes, returns; same activity, answer, progress are present.
8. After evidenced understanding, concept state updates; next review is scheduled and due list reflects it.
9. User follows a curiosity branch (`wheel wear`) within existing course; graph extends, no new chat created.

### Flow B: Goal-oriented course

1. User types `I want to learn Python to automate spreadsheet tasks`.
2. Ada identifies desired outcome and asks about existing Python experience and weekly time budget, as appropriate.
3. Course proposal names practical success criterion such as “write a script that reads a CSV and outputs a summary,” with constraints matched to learner.
4. Initial concept graph includes variables, iteration, collections, CSV basics, and an application task; no hardcoded lesson plan.
5. During lessons, multiple-choice and free response get graded against rules/rubrics. Hint use is persisted as `assisted`.
6. Progress indicates `Developing` / `Approaching` only when evidence supports it; no credit solely for viewing explanations.
7. Learner edits goal to `Python for data visualization`; existing evidence persists, new goal version and plan are produced, and readiness recalculates without resetting the course.

### Flow C: Multi-course continuity

1. Create courses `Black holes` and `Chess`.
2. Sidebar shows precisely these course objects (not every lesson/session).
3. Navigating to Chess does not insert Black Holes' specific conversation context; only explicitly allowed global preferences can carry over.
4. Due review belongs to its source course and can be launched from a consolidated queue.
5. Deleting Chess leaves Black Holes intact and removes Chess reviews/evidence.

### Flow D: Failure and accessibility

1. A model request times out during proposal; existing draft and user response remain; retry is possible without duplicate course.
2. Double-clicking submit creates one attempt and one evidence record.
3. Another authenticated user cannot fetch or mutate someone else's course by guessing IDs.
4. Keyboard-only user can create, answer, navigate, pause and resume; screen reader labels are meaningful.
5. User with reminders disabled receives no external notification.

---

## 10. Telemetry and product evaluation

Collect opt-in/privacy-respecting operational events without sensitive raw answer text by default: `course_draft_started`, `clarification_answered`, `course_created`, `first_activity_rendered`, `attempt_submitted`, `session_completed`, `course_resumed`, `review_due`, `review_completed`, `course_goal_revised`, `model_error`. Measure time to first useful activity, completion/resume, delayed recall, independent transfer, curriculum validity, model latency/cost, user-return rate, and incorrect/unsupported explanation rate. Provide structured request IDs and protected error logging. Product claims about superior retention require comparative user study; instrument to make that possible, not to assert it upfront.

---

## 11. Privacy, safety, and reliability

- Explain clearly that Ada uses third-party model APIs to generate and assess lessons; avoid sending secrets or unnecessary profile fields in prompts.
- Server-side auth, ownership checks and RLS on all learner records. Keep API keys and service-role keys only on server.
- HTTPS in production, secure HttpOnly auth cookies, CSRF-safe patterns, request/body size limits, rate limits for model-consuming endpoints, budget ceilings per user/course/day, no public anonymous mutation endpoints.
- Validate and sanitize Markdown, bound URLs, reject unsafe arbitrary HTML/script/iframe and model-driven navigation commands.
- Never execute user-provided code in server process; a future sandbox needs network/process isolation, resource limits and review.
- Use optimistic updates with reconciliation, idempotent submissions, audit trail for generated lesson and evaluation data; resilient loading/retries.
- High-stakes topics: teaching is educational, not licensed advice, and Ada should not claim certified competence. Validate claims rather than overconfidently generating sources.
- Sensitive user data: privacy-by-default, data deletion/export support, least privilege, avoid large raw log retention.
- Prompt injection: externally sourced text and learner answers are task data, never instructions overriding system or app rules.
- Notify only after explicit consent; central throttling/quiet hours; unsubscribe and preferences, no nagging.

---

## 12. Default technical stack (if not constrained by existing repo)

- **App:** Next.js (current stable) App Router, TypeScript strict mode, React; server components for shell/data and client components for interactive activity/answer forms.
- **UI:** Tailwind CSS, shadcn/ui primitives (lightly customized), Lucide icons; `react-hook-form` if useful, but keep forms minimal.
- **Auth & database:** Supabase Auth + managed PostgreSQL, `@supabase/ssr`, SQL migrations, RLS. Use typed queries and SQL constraints; avoid duplicative ORM abstraction unless repo already has one. Local development through Supabase CLI or documented hosted dev instance.
- **AI:** OpenAI server SDK behind `LearningModel` interface; real configured provider; strict Zod structured output parsing. `MOCK_MODEL=true` only for tests/dev and visibly flagged.
- **Validation:** Zod end-to-end schemas. Define learner-facing and private activity DTO separately.
- **Jobs:** For P0, lazy due review calculation on reads plus persisted due dates. Add Vercel Cron or equivalent scheduled worker for P1 reminders. Jobs must be idempotent, per-user-throttled.
- **Tests:** Vitest + React Testing Library; Playwright for E2E; DB integration tests against test schema/database. Mock external model only in deterministic automated tests, with at least one documented real-model smoke test.
- **Deployment:** Vercel (or compatible node host), Supabase production project, environment variables and migrations in deployment docs. Do not assume enterprise infra.

**Environment example (`.env.example`):**

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=     # server only; cron/admin use, never client
OPENAI_API_KEY=                 # server only
ADA_MODEL_CLARIFY=              # configured supported model ID
ADA_MODEL_COMPILE=
ADA_MODEL_TUTOR=
ADA_MODEL_EVALUATE=
MOCK_MODEL=false                # dev/test only
APP_BASE_URL=http://localhost:3000
```

Make environment validation explicit. Add `SUPABASE_DB_URL` if migration/tooling requires it. Never commit actual `.env.local`.

---

## 13. Project organization

Suggested tree (adjust to repo conventions):

```text
src/
  app/
    (auth)/login/page.tsx
    app/page.tsx
    app/new/page.tsx
    app/courses/[courseId]/page.tsx
    app/courses/[courseId]/outline/page.tsx
    app/courses/[courseId]/progress/page.tsx
    app/settings/page.tsx
    api/v1/.../route.ts
  components/
    layout/course-sidebar.tsx
    course/new-course-prompt.tsx
    course/course-setup.tsx
    course/course-header.tsx
    lesson/activity-renderer.tsx
    lesson/explanation.tsx
    lesson/multiple-choice.tsx
    lesson/free-response.tsx
    lesson/feedback.tsx
  lib/
    auth/
    db/
    ai/model-adapter.ts
    ai/openai-model.ts
    ai/mock-model.ts
    ai/prompts/
    learning/clarification.ts
    learning/curriculum.ts
    learning/next-action.ts
    learning/assessment.ts
    learning/mastery.ts
    learning/review-scheduler.ts
    schemas/
    security/
  tests/
supabase/migrations/
README.md
IMPLEMENTATION_STATUS.md
DECISIONS.md
.env.example
```

Separation: UI rendering never calls AI directly; route handlers call domain services; domain services own transitions and DB transactions; adapters own model API and validation; database is source of truth. Avoid tightly coupling all logic into React server actions.

---

## 14. Component interaction behavior

- **Prompt:** Inline character limit/error. Empty submit disabled. On submit show small progress state; avoid full-screen spinner.
- **Course setup:** Ada question at a time. Quick replies are accessible buttons; custom answer text always available. `Start now` lets user bypass optional questions with explicit assumptions.
- **Generate:** Create draft first; once proposal ready allow edit; create course transactionally. Display meaningful first concepts; do not pretend estimated cadence is certain.
- **Lesson:** One activity visible. For `multiple_choice`, options use proper radio semantics and preserve choice until submitted. For `free_response`, autosave debounced. Feedback appears inline with a clear Continue. Hints mark assistance. Explanation-type content can be followed by an assessment; reading is not scored.
- **Sidebar:** Show course list ordered by last touched; active highlight; truncation + accessible tooltip. New course remains visible from any screen. Long lists scroll. Course rename and delete in a contextual menu.
- **Progress:** When zero evidence: explain why estimate is unavailable. When assisted answer: describe partial progress without marking independently demonstrated.
- **Reviews:** Due state presented gently; no notification till opted in. Review question is fresh variant and links to concept.

---

## 15. Edge cases to handle intentionally

- Model returns malformed JSON, references a nonexistent concept, or has cyclic prerequisites → repair once, fallback with clear retry, never corrupt DB.
- A topic with no obvious skill assessment → create curiosity course and ask explain-back/compare questions; do not fabricate quantifiable mastery.
- Learner gives unexpected free-text answer to a quick reply → accept it and update draft context.
- Learner changes objective after many sessions → version goal, retain evidence, update outline with revision history, disclose readiness change.
- Multi-tab course open → use version conflict handling; do not silently clobber drafts/attempts.
- Learner skips/reveals answer → record as exposure, not independent success.
- API interruption after model generated content but before save → safe idempotent recovery with durable session state.
- Time zone changes → due review dates preserve correct absolute timestamps; display locally.
- Long course titles/unusual Unicode → safe rendering, length validation, no layout break.
- Hard-to-source niche content → express uncertainty, avoid fabricated references.
- Session interrupted or network dropped → preserve previously saved draft and restore current activity on reload.

---

## 16. Test plan

### Unit tests

- Clarification returns at most one question and honors curiosity intent / start-now.
- Curriculum parser rejects invalid graph, duplicate slug, wrong ID, cycle, excessive node count.
- Learning controller legal state transitions; no duplicate `next` after stale request.
- MC grading deterministic, answer key server-only; assisted attempts do not satisfy independent mastery requirement.
- Mastery statuses respond correctly to evidence sequence; review schedule uses right intervals/timezone.
- Goal revision preserves evidence and changes target-relative assessment.
- Course listing always user-scoped; deleted course omitted.

### Integration tests

- Course creation atomic and idempotent; draft conversion unique.
- Attempts/evidence persist with retry key; one submission never produces two records.
- Session pause/resume returns same activity and saved draft.
- RLS denies cross-user row access; all route handlers unauthorized on foreign IDs.
- Review due records created/updated transactionally; reminders disabled by default.
- OpenAI adapter handles structured output, timeout, invalid output and retries with bounded budget.

### Playwright E2E

- Curiosity flow from topic to personalized plan to assessment/feedback and reload/resume.
- Goal flow from topic to clarifications to first lesson and progress explanation.
- Sidebar shows exactly one item per course and never shows a session/chat list.
- Keyboard-only path; mobile drawer; accessible radio choices and feedback.
- Failure/retry preserves draft and avoids duplicate course.

### Manual real-model smoke tests

- Generate courses for `How train wheels work`, `Black holes`, `Python to automate spreadsheets`, and an unseen niche topic. Verify content differs meaningfully, concept graph coheres, questions are teachable, rubric is sensible, and next lesson is on-topic. Record output quality and error cases. These are not fixed seeded curricula.

---

## 17. Definition of Done for P0

All must be true:

- [ ] Running app with README and `.env.example`, successful build/typecheck/lint/test.
- [ ] Real auth, DB migrations, policies and authorized route handlers.
- [ ] New account sees simple prompt and empty course sidebar.
- [ ] Topic triggers adaptive **one-at-a-time** course questions.
- [ ] Arbitrary topic generates a real curriculum from configured LLM, without topic-specific hardcoding.
- [ ] Draft persists and converts exactly once into sidebar course.
- [ ] Distinct curiosity and goal courses work and can coexist.
- [ ] Lessons are truly generated and rendered through safe activity components.
- [ ] Learner can respond, receive grading/feedback and request hint/alternate explanation.
- [ ] Correct/incorrect/assisted attempts persist as assessment evidence.
- [ ] Course outline, evidence-based progress, and review queue reflect those attempts.
- [ ] Refresh, sign out/in, and resume retain course/session/draft state.
- [ ] Goal edit retains evidence and creates goal version.
- [ ] Delete course and associated learner data works.
- [ ] Security/authorization/idempotency/failure cases covered by tests.
- [ ] Desktop UI is restrained, accessible, and responsive, not dashboard-heavy.
- [ ] No fabricated proficiency metric or citations, and no claim that mocks are functioning AI.

---

## 18. Decision log: committed vs. provisional

**Committed:** Course is top-level object; courses replace chats in sidebar; home is one prompt; conversational clarification; minimal desktop UI; adaptive course creation; persistent evidence and session state; two learning intents; structured assessment; spaced review; global Ada persona and per-course coach state; model-generated teaching within validated components.

**Implementation defaults, revisable:** Next.js/Supabase/OpenAI, simple lesson tab layout, four activity types, mastery status rules, review intervals, exact number of initial concept nodes, first-pass readiness bands, P0 review surfaced in course instead of global top-level nav. Preserve flexibility to change these after user testing.

**Explicitly unresolved:** Consumer label for course subsections (lessons/modules/chapters); how proactive email and push notifications are delivered; advanced graph display; confidence calibration after real learner data; verified retrieval for niche facts; source provenance thresholds; future code runner and rich simulations.

---

## 19. A note on pedagogy and differentiation

Do not make a conventional LMS that simply checks off lessons. Ada's educational loop should contain (when relevant) retrieval/prediction before explanation, short worked examples, learner application, feedback with retry, repeated independent assessment over time, and scheduled recall. The lesson sequence adapts to misconceptions and curiosity branches. This should be apparent in code architecture and acceptance tests. Avoid unsupported “learning styles,” badges that reward superficial activity, or precise readiness claims unsupported by outcomes.

---

## 20. Implementation order for Codex

**Slice 0 — Bootstrap (first commit):** repo inspection, stack selection, environment config, shell/routes/styles, auth and migrations, test harness. README explains setup. On `/app`, show only prompt + sidebar courses. Add one screenshot/test.

**Slice 1 — Course creation:** draft entity, intake clarifier, dynamic model adapter, one-question UI, proposal compiler, atomic conversion, course sidebar. Deliver two working model-generated draft/course paths. Run tests.

**Slice 2 — Course workspace:** header, Learn/Outline/Progress routes, concept hierarchy, first session and activity rendering. Add activity DTO schema, teacher/private field separation. Run tests.

**Slice 3 — Learning loop:** hints/alternative explanation, answer submission, deterministic and rubric grading, assistance tracking, evidence, mastery policy, feedback, next action, pause/resume/autosave. Run tests.

**Slice 4 — Retention & goal revision:** review queue, scheduled due dates, review activity, goal versioning, course continuation/branch basics, meaningful progress views. Run tests.

**Slice 5 — Hardening and delivery:** edge cases, authorization regression suite, idempotency/retries, mobile/a11y polish, logging/cost guards, course deletion, full E2E, deployment guide, documented known limitations.

At the end of each slice, report: changed files, what runs, tests executed/results, what remains, risks/blockers, and exact next slice. Avoid claiming the entire spec has been built after a UI-only first pass.

---

## 21. Suggested first command to Codex

> Read `ADA_CODEX_BUILD_SPEC.md` in full and inspect the current repository. Treat the document as the implementation contract and `Ada_Concept_Architecture_Roadmap.md` as background context. Create `IMPLEMENTATION_STATUS.md` and `DECISIONS.md`, then implement **Slice 0** followed by **Slice 1**, with working backend persistence and real model-powered course creation (mock model only for tests/local fallback). Use the design principles in §3: course-first sidebar, a minimal “What would you like to learn?” home prompt, and one-at-a-time conversational setup. Do not build a chat history interface or static course catalog. Run lint, typecheck, unit tests, and the relevant E2E tests; document how to configure and launch the result. After those slices, report verified functionality and propose the next implementation steps.
