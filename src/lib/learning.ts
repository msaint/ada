import type { Course, Evidence } from "./schema";
type EvidenceSummary = Pick<
  Evidence,
  "activityId" | "question" | "assisted" | "result" | "difficulty" | "concept"
>;
export function status(
  evidence: EvidenceSummary[],
  dueAt?: string,
  now = Date.now(),
) {
  if (dueAt && Date.parse(dueAt) <= now) return "Review due";
  if (!evidence.length) return "Not assessed";
  const successes = evidence.filter(
    (e) => e.result.result === "correct" && !e.assisted,
  );
  if (
    new Set(successes.map((e) => e.question.trim().toLowerCase())).size >= 2 &&
    successes.some((e) => e.difficulty >= 2)
  )
    return "Demonstrated";
  return "Developing";
}
export function interval(repetitions: number, independentSuccess: boolean) {
  return independentSuccess ? [1, 3, 7, 14, 30][Math.min(repetitions, 4)] : 1;
}
export function nextConcept(c: Course) {
  const due = c.reviews
    .filter((r) => Date.parse(r.dueAt) <= Date.now())
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
  if (due) return { slug: due.concept, review: true };
  const eligible = c.plan.concepts.filter((n) =>
    n.prerequisites.every((p) =>
      c.evidence.some(
        (e) => e.concept === p && e.result.result === "correct" && !e.assisted,
      ),
    ),
  );
  const pool = eligible.length ? eligible : [c.plan.concepts[0]];
  const ranked = pool
    .map((n) => ({ n, e: c.evidence.filter((e) => e.concept === n.slug) }))
    .sort(
      (a, b) =>
        (status(a.e) === "Demonstrated" ? 100 : 0) +
        a.e.length -
        ((status(b.e) === "Demonstrated" ? 100 : 0) + b.e.length),
    );
  return { slug: ranked[0].n.slug, review: false };
}
export function readiness(c: {
  plan: Course["plan"];
  evidence: EvidenceSummary[];
}) {
  const assessed = c.plan.concepts.filter((n) =>
    c.evidence.some((e) => e.concept === n.slug),
  );
  if (assessed.length < c.plan.concepts.length)
    return "Not enough evidence yet";
  const demonstrated = c.plan.concepts.filter(
    (n) =>
      status(c.evidence.filter((e) => e.concept === n.slug)) === "Demonstrated",
  ).length;
  return demonstrated === c.plan.concepts.length
    ? "Demonstrated"
    : demonstrated >= c.plan.concepts.length * 0.7
      ? "Approaching"
      : demonstrated
        ? "Developing"
        : "Early";
}
