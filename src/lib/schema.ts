import { z } from "zod";
const text = z.string().trim().min(1).max(6000);
export const conceptSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]{1,70}$/),
    title: text.max(160),
    description: text,
    criteria: z.array(text).min(1).max(6),
    prerequisites: z.array(z.string()).max(10),
  })
  .strict();
export const proposalSchema = z
  .object({
    title: text.max(160),
    direction: text.max(800),
    intent: z.enum(["curiosity", "goal"]),
    cadence: text.max(300),
    assumptions: z.array(text).max(6),
    concepts: z.array(conceptSchema).min(3).max(30),
  })
  .strict()
  .superRefine((p, ctx) => {
    const slugs = new Set(p.concepts.map((c) => c.slug));
    if (slugs.size !== p.concepts.length)
      ctx.addIssue({ code: "custom", message: "Duplicate concept slug" });
    const visited = new Set<string>(),
      active = new Set<string>();
    function visit(slug: string): boolean {
      if (active.has(slug)) return false;
      if (visited.has(slug)) return true;
      active.add(slug);
      const c = p.concepts.find((c) => c.slug === slug);
      if (!c) return false;
      for (const pre of c.prerequisites) if (!visit(pre)) return false;
      active.delete(slug);
      visited.add(slug);
      return true;
    }
    for (const c of p.concepts)
      if (!visit(c.slug)) {
        ctx.addIssue({
          code: "custom",
          message: "Missing prerequisite or cycle",
        });
        break;
      }
  });
export const clarificationSchema = z
  .object({
    status: z.enum(["ask", "ready"]),
    question: z.string().max(500),
    options: z.array(text.max(120)).max(4),
    field: z.enum(["intent", "baseline", "time", "ready"]),
  })
  .strict();
export const activitySchema = z
  .object({
    kind: z.enum([
      "explanation",
      "multiple_choice",
      "free_response",
      "reflection",
    ]),
    title: text.max(160),
    body: text,
    prompt: text,
    choices: z
      .array(z.object({ id: z.string().max(30), text: text.max(400) }).strict())
      .max(5),
    correctChoiceId: z.string().max(30),
    idealAnswerPrivate: z.string().max(4000),
    rubric: z.array(text.max(500)).max(6),
    rationale: z.string().max(3000),
    hint: text.max(1000),
    difficulty: z.number().int().min(1).max(3),
  })
  .strict()
  .superRefine((a, ctx) => {
    if (
      a.kind === "multiple_choice" &&
      (a.choices.length < 2 ||
        new Set(a.choices.map((c) => c.id)).size !== a.choices.length ||
        !a.choices.some((c) => c.id === a.correctChoiceId))
    )
      ctx.addIssue({
        code: "custom",
        message: "Invalid multiple choice answer",
      });
    if (
      a.kind === "free_response" &&
      (!a.rubric.length || !a.idealAnswerPrivate)
    )
      ctx.addIssue({ code: "custom", message: "Missing assessment rubric" });
  });
export const evaluationSchema = z
  .object({
    result: z.enum(["correct", "partial", "incorrect", "uncertain"]),
    feedback: text.max(3000),
    criteria: z
      .array(
        z.object({ criterion: text, met: z.boolean(), reason: text }).strict(),
      )
      .max(6),
  })
  .strict();
export const alternativeSchema = z.object({ body: text }).strict();
export type Proposal = z.infer<typeof proposalSchema>;
export type ActivitySpec = z.infer<typeof activitySchema>;
export type Evaluation = z.infer<typeof evaluationSchema>;
export type Draft = {
  id: string;
  topic: string;
  answers: string[];
  question?: z.infer<typeof clarificationSchema>;
  proposal?: Proposal;
  courseId?: string;
  revision: number;
};
export type Evidence = {
  id: string;
  activityId: string;
  concept: string;
  question: string;
  answer: string;
  assisted: boolean;
  difficulty: number;
  at: string;
  result: Evaluation;
  model: string;
  rubric: string[];
  review: boolean;
};
export type Activity = {
  id: string;
  concept: string;
  spec: ActivitySpec;
  answer: string;
  answerVersion: number;
  assisted: boolean;
  alternative?: string;
  feedback?: Evaluation;
  skipped?: boolean;
  isReview: boolean;
};
export type Course = {
  id: string;
  title: string;
  topic: string;
  intent: "curiosity" | "goal";
  goals: { text: string; at: string }[];
  plan: Proposal;
  curriculumVersions: Proposal[];
  activities: Activity[];
  current: number;
  sessionStatus: "active" | "paused";
  evidence: Evidence[];
  reviews: {
    concept: string;
    dueAt: string;
    repetitions: number;
    interval: number;
  }[];
  updatedAt: string;
};
export type State = {
  drafts: Draft[];
  courses: Course[];
  keys: Record<string, string>;
  preferences: { timezone: string; displayName: string };
  budget: { day: string; count: number; minute: number; burst: number };
};
export const initialState = (): State => ({
  drafts: [],
  courses: [],
  keys: {},
  preferences: { timezone: "UTC", displayName: "" },
  budget: { day: "", count: 0, minute: 0, burst: 0 },
});
export function publicActivity(a: Activity) {
  const {
    correctChoiceId: _key,
    idealAnswerPrivate: _ideal,
    rubric: _rubric,
    rationale: _reason,
    hint: _hint,
    ...safe
  } = a.spec;
  void _key;
  void _ideal;
  void _rubric;
  void _reason;
  void _hint;
  return { ...a, spec: safe, hint: a.assisted ? a.spec.hint : undefined };
}
export function publicState(s: State) {
  return {
    drafts: s.drafts,
    courses: s.courses
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((c) => ({
        ...c,
        evidence: c.evidence.map(({ rubric: _rubric, ...e }) => {
          void _rubric;
          return e;
        }),
        activities: c.activities.map(publicActivity),
      })),
    preferences: s.preferences,
  };
}
export type PublicState = ReturnType<typeof publicState>;
export type PublicCourse = PublicState["courses"][number];
