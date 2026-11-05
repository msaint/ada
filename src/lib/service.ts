import { z } from "zod";
import { learningModel, modelName } from "./model";
import { readState, writeState, reserveBudget, Conflict } from "./store";
import {
  proposalSchema,
  publicState,
  type Course,
  type Activity,
} from "./schema";
import { interval, nextConcept } from "./learning";
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const fail = (message: string, status = 400): never => {
  throw Object.assign(new Error(message), { status });
};
export const commandSchema = z
  .object({
    action: z.enum([
      "createDraft",
      "answerDraft",
      "propose",
      "adjust",
      "convert",
      "session",
      "saveAnswer",
      "attempt",
      "hint",
      "explain",
      "next",
      "skip",
      "pause",
      "goal",
      "rename",
      "delete",
      "preferences",
    ]),
    resource: z.string().uuid().optional(),
    activityId: z.string().uuid().optional(),
    text: z.string().max(10000).optional(),
    key: z.string().uuid().optional(),
    version: z.number().int().nonnegative().optional(),
    intent: z.enum(["curiosity", "goal"]).optional(),
    timezone: z.string().max(80).optional(),
  })
  .strict();
export type Command = z.infer<typeof commandSchema>;
export async function view(owner: string) {
  const s = await readState(owner);
  return publicState(s.data);
}
export async function command(owner: string, input: Command) {
  const cmd = commandSchema.parse(input);
  let snapshot = await readState(owner);
  const aiActions = [
    "createDraft",
    "answerDraft",
    "propose",
    "session",
    "attempt",
    "explain",
    "next",
    "skip",
    "goal",
  ];
  const receipt = cmd.key && snapshot.data.keys[cmd.key];
  if (receipt) return { state: publicState(snapshot.data), resource: receipt };
  if (aiActions.includes(cmd.action)) {
    await reserveBudget(owner);
    snapshot = await readState(owner);
  }
  const s = snapshot.data;
  let resource = cmd.resource;
  const course = () =>
    s.courses.find((c) => c.id === cmd.resource) ||
    fail("Course not found.", 404);
  const draft = () =>
    s.drafts.find((d) => d.id === cmd.resource) ||
    fail("Draft not found.", 404);
  const activity = (c: Course) => {
    const current =
      c.activities[c.current] || fail("Start a lesson first.", 409);
    if (cmd.activityId !== current.id) throw new Conflict();
    return current;
  };
  const text = () => cmd.text?.trim() || fail("Please enter a response.");
  const generate = async (c: Course, requestedKind?: string) => {
    const target = nextConcept(c);
    const spec = await learningModel.activity(
      c,
      target.slug,
      target.review,
      requestedKind,
    );
    const a: Activity = {
      id: id(),
      concept: target.slug,
      spec,
      answer: "",
      answerVersion: 0,
      assisted: false,
      isReview: target.review,
    };
    c.activities.push(a);
    c.current = c.activities.length - 1;
    c.sessionStatus = "active";
    c.updatedAt = now();
  };
  switch (cmd.action) {
    case "createDraft": {
      const topic = z.string().trim().min(1).max(500).parse(text());
      const d = { id: id(), topic, answers: [], revision: 0 };
      s.drafts.push(d);
      resource = d.id;
      // Persist before contacting provider: failed requests retain a resumable draft.
      if (cmd.key) s.keys[cmd.key] = d.id;
      await writeState(owner, snapshot);
      try {
        const question = await learningModel.clarify(d);
        snapshot = await readState(owner);
        const saved = snapshot.data.drafts.find((x) => x.id === d.id)!;
        if (question.status === "ready")
          saved.proposal = await learningModel.compile(saved);
        else saved.question = question;
        await writeState(owner, snapshot);
      } catch (e) {
        return {
          state: publicState((await readState(owner)).data),
          resource: d.id,
          notice: e instanceof Error ? e.message : "Retry setup.",
        };
      }
      return { state: publicState(snapshot.data), resource };
    }
    case "answerDraft": {
      const d = draft();
      if (d.courseId) fail("This draft is already a course.", 409);
      if (cmd.version !== undefined && cmd.version !== d.revision)
        throw new Conflict();
      if (d.answers.length >= 4 || cmd.text === "Start now")
        d.answers.push("Start now — infer modest defaults.");
      else d.answers.push(z.string().max(1500).parse(text()));
      d.revision++;
      d.proposal = undefined;
      d.question = undefined;
      if (cmd.key) s.keys[cmd.key] = d.id;
      await writeState(owner, snapshot);
      const saved = await readState(owner),
        updated = saved.data.drafts.find((x) => x.id === d.id)!;
      if (updated.answers.length >= 4 || cmd.text === "Start now")
        updated.proposal = await learningModel.compile(updated);
      else {
        const q = await learningModel.clarify(updated);
        if (q.status === "ready")
          updated.proposal = await learningModel.compile(updated);
        else updated.question = q;
      }
      await writeState(owner, saved);
      return { state: publicState(saved.data), resource };
    }
    case "propose": {
      const d = draft();
      if (d.courseId) fail("This draft is already a course.", 409);
      d.proposal = await learningModel.compile(d);
      d.question = undefined;
      break;
    }
    case "adjust": {
      const d = draft();
      if (d.courseId) fail("Course already created.", 409);
      d.answers.pop();
      d.question = undefined;
      d.proposal = undefined;
      d.revision++;
      break;
    }
    case "convert": {
      const d = draft();
      if (d.courseId) {
        resource = d.courseId;
        break;
      }
      if (!d.proposal) fail("Generate a starting path first.", 409);
      const p = d.proposal!;
      const c: Course = {
        id: id(),
        title: p.title,
        topic: d.topic,
        intent: p.intent,
        goals: [{ text: p.direction, at: now() }],
        plan: p,
        curriculumVersions: [p],
        activities: [],
        current: 0,
        sessionStatus: "active",
        evidence: [],
        reviews: [],
        updatedAt: now(),
      };
      s.courses.push(c);
      d.courseId = c.id;
      resource = c.id;
      break;
    }
    case "session": {
      const c = course();
      if (!c.activities.length) await generate(c);
      c.sessionStatus = "active";
      break;
    }
    case "saveAnswer": {
      const c = course(),
        a = activity(c);
      if (a.feedback) fail("Answer already submitted.", 409);
      if (cmd.version !== a.answerVersion) throw new Conflict();
      a.answer = cmd.text || "";
      a.answerVersion++;
      break;
    }
    case "hint": {
      const a = activity(course());
      a.assisted = true;
      break;
    }
    case "explain": {
      const a = activity(course());
      a.alternative = await learningModel.explain(a);
      a.assisted = true;
      break;
    }
    case "attempt": {
      const c = course(),
        a = activity(c);
      if (a.feedback) break;
      a.answer = text();
      if (
        a.spec.kind === "multiple_choice" &&
        !a.spec.choices.some((x) => x.id === a.answer)
      )
        fail("Choose one of the options.");
      // Durable answer before grading; provider failures leave a retriable submission.
      a.answerVersion++;
      await writeState(owner, snapshot);
      snapshot = await readState(owner);
      const current = snapshot.data.courses.find((x) => x.id === c.id)!;
      const target = current.activities[current.current];
      if (target.id !== a.id || target.feedback) throw new Conflict();
      const result = await learningModel.evaluate(target, target.answer);
      target.feedback = result;
      if (
        target.spec.kind !== "reflection" &&
        target.spec.kind !== "explanation"
      ) {
        const ev = {
          id: id(),
          activityId: target.id,
          concept: target.concept,
          question: target.spec.prompt,
          answer: target.answer,
          assisted: target.assisted,
          difficulty: target.spec.difficulty,
          at: now(),
          result,
          model: modelName("evaluate"),
          rubric: target.spec.rubric,
          review: target.isReview,
        };
        current.evidence.push(ev);
        const review = current.reviews.find(
            (r) => r.concept === target.concept,
          ),
          success = result.result === "correct" && !target.assisted;
        const reps = success
          ? (review?.repetitions || 0) + (target.isReview ? 1 : 0)
          : 0;
        const days = interval(reps, success);
        const dueAt = new Date(Date.now() + days * 86400000).toISOString();
        if (review)
          Object.assign(review, { dueAt, repetitions: reps, interval: days });
        else
          current.reviews.push({
            concept: target.concept,
            dueAt,
            repetitions: reps,
            interval: days,
          });
      }
      current.updatedAt = now();
      if (cmd.key) snapshot.data.keys[cmd.key] = c.id;
      await writeState(owner, snapshot);
      return { state: publicState(snapshot.data), resource };
    }
    case "next": {
      const c = course(),
        a = activity(c);
      if (!a.feedback && a.spec.kind !== "explanation")
        fail("Read your feedback before continuing.", 409);
      await generate(
        c,
        a.feedback?.result === "incorrect" ? "explanation" : undefined,
      );
      break;
    }
    case "skip": {
      const c = course(),
        a = activity(c);
      a.skipped = true;
      a.assisted = true;
      await generate(c);
      break;
    }
    case "pause":
      course().sessionStatus = "paused";
      break;
    case "goal": {
      const c = course(),
        goal = z.string().max(800).parse(text());
      const p = await learningModel.compile({
        id: id(),
        topic: c.topic,
        answers: [
          `Revised intent: ${cmd.intent || c.intent}. New direction: ${goal}`,
          `Preserve these existing concept slugs when relevant: ${c.plan.concepts.map((n) => n.slug).join(", ")}`,
        ],
        revision: 0,
      });
      c.goals.push({ text: goal, at: now() });
      c.intent = cmd.intent || p.intent;
      c.curriculumVersions.push(p);
      // Keep existing concept identity/evidence; append new concepts and revised criteria.
      c.plan = {
        ...p,
        concepts: [
          ...c.plan.concepts.map(
            (old) => p.concepts.find((n) => n.slug === old.slug) || old,
          ),
          ...p.concepts.filter(
            (n) => !c.plan.concepts.some((old) => old.slug === n.slug),
          ),
        ],
      };
      c.plan = proposalSchema.parse(c.plan);
      c.updatedAt = now();
      break;
    }
    case "rename":
      course().title = z.string().max(160).parse(text());
      break;
    case "delete": {
      const c = course();
      s.courses = s.courses.filter((x) => x.id !== c.id);
      s.drafts = s.drafts.filter((d) => d.courseId !== c.id);
      for (const [key, value] of Object.entries(s.keys))
        if (value === c.id) s.keys[key] = "deleted";
      break;
    }
    case "preferences": {
      const tz = cmd.timezone || s.preferences.timezone;
      try {
        new Intl.DateTimeFormat("en", { timeZone: tz });
      } catch {
        fail("Enter a valid time zone, such as America/Chicago.");
      }
      s.preferences = {
        displayName: (cmd.text || "").slice(0, 100),
        timezone: tz,
      };
      break;
    }
  }
  if (cmd.key) snapshot.data.keys[cmd.key] = resource || cmd.action;
  await writeState(owner, snapshot);
  return { state: publicState(snapshot.data), resource };
}
export async function exportState(owner: string) {
  return publicState((await readState(owner)).data);
}
