import { describe, it, expect } from "vitest";
import {
  proposalSchema,
  activitySchema,
  publicActivity,
  type Evidence,
} from "../src/lib/schema";
import { status, interval } from "../src/lib/learning";
const node = (slug: string, prerequisites: string[] = []) => ({
  slug,
  prerequisites,
  title: slug,
  description: "A concept",
  criteria: ["Explain it"],
});
const proposal = (concepts: ReturnType<typeof node>[]) => ({
  title: "A test course",
  direction: "Explore a topic",
  intent: "curiosity",
  cadence: "Ten minutes",
  assumptions: [],
  concepts,
});
const evidence = (id: string, assisted = false, difficulty = 2): Evidence => ({
  id,
  activityId: id,
  concept: "a",
  question: "Question " + id,
  answer: "an answer",
  assisted,
  difficulty,
  at: new Date().toISOString(),
  result: { result: "correct", feedback: "Clear explanation", criteria: [] },
  model: "test",
  rubric: ["Explain"],
  review: false,
});
describe("curriculum validation", () => {
  it("accepts a connected DAG", () =>
    expect(
      proposalSchema.safeParse(
        proposal([node("a"), node("b", ["a"]), node("c", ["b"])]),
      ).success,
    ).toBe(true));
  it("rejects cycles, dangling references and duplicate identities", () => {
    for (const nodes of [
      [node("a", ["c"]), node("b", ["a"]), node("c", ["b"])],
      [node("a"), node("b", ["missing"]), node("c")],
      [node("a"), node("a"), node("c")],
    ])
      expect(proposalSchema.safeParse(proposal(nodes)).success).toBe(false);
  });
});
describe("learning evidence", () => {
  it("does not establish proficiency from a single or assisted success", () => {
    expect(status([])).toBe("Not assessed");
    expect(status([evidence("1")])).toBe("Developing");
    expect(status([evidence("1", true), evidence("2", true)])).toBe(
      "Developing",
    );
  });
  it("requires two different independent successes with challenge", () => {
    expect(status([evidence("1", false, 1), evidence("2", false, 1)])).toBe(
      "Developing",
    );
    expect(status([evidence("1"), evidence("1")])).toBe("Developing");
    expect(status([evidence("1"), evidence("2")])).toBe("Demonstrated");
  });
  it("due review is not evidence of failure", () =>
    expect(
      status([evidence("1"), evidence("2")], new Date(0).toISOString()),
    ).toBe("Review due"));
  it("expands spaced recall only for independent success", () => {
    expect([0, 1, 2, 3, 4, 9].map((i) => interval(i, true))).toEqual([
      1, 3, 7, 14, 30, 30,
    ]);
    expect(interval(4, false)).toBe(1);
  });
});
it("never sends private assessment fields before grading", () => {
  const spec = activitySchema.parse({
    kind: "multiple_choice",
    title: "Question",
    body: "Context",
    prompt: "What follows?",
    choices: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
    correctChoiceId: "a",
    idealAnswerPrivate: "secret",
    rubric: ["private rubric"],
    rationale: "private rationale",
    hint: "Private hint",
    difficulty: 2,
  });
  const safe = publicActivity({
    id: "1",
    concept: "a",
    spec,
    answer: "",
    answerVersion: 0,
    assisted: false,
    isReview: false,
  });
  expect(safe.spec).not.toHaveProperty("correctChoiceId");
  expect(safe.spec).not.toHaveProperty("idealAnswerPrivate");
  expect(safe.spec).not.toHaveProperty("rubric");
  expect(safe.spec).not.toHaveProperty("rationale");
  expect(safe.hint).toBeUndefined();
});
