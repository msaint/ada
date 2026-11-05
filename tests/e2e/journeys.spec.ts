import { test, expect, type APIRequestContext } from "@playwright/test";
const origin = "http://localhost:3000";
async function command(
  request: APIRequestContext,
  action: string,
  resource?: string,
  text?: string,
  extra: object = {},
) {
  let activityId: string | undefined;
  if (
    [
      "saveAnswer",
      "attempt",
      "hint",
      "explain",
      "next",
      "skip",
      "pause",
    ].includes(action)
  ) {
    const data = await (await request.get("/api/v1/state")).json();
    const c = data.state.courses.find((c: { id: string }) => c.id === resource);
    activityId = c?.activities[c.current]?.id;
  }
  const response = await request.post("/api/v1/command", {
    headers: { Origin: origin },
    data: {
      action,
      resource,
      text,
      activityId,
      key: crypto.randomUUID(),
      ...extra,
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}
test("curiosity: persistent setup → course → feedback → exact resume → deletion", async ({
  request,
}) => {
  const d = await command(
    request,
    "createDraft",
    undefined,
    "The physics of unusual musical instruments",
  );
  await command(request, "answerDraft", d.resource, "I’m just curious", {
    version: 0,
  });
  await command(request, "answerDraft", d.resource, "Start now", {
    version: 1,
  });
  const c = await command(request, "convert", d.resource);
  expect(
    c.state.courses.find((x: { id: string }) => x.id === c.resource).intent,
  ).toBe("curiosity");
  const session = await command(request, "session", c.resource);
  const activity = session.state.courses.find(
    (x: { id: string }) => x.id === c.resource,
  ).activities[0];
  expect(activity.spec.correctChoiceId).toBeUndefined();
  await command(request, "saveAnswer", c.resource, "a", { version: 0 });
  await command(request, "pause", c.resource);
  const resumed = await command(request, "session", c.resource);
  expect(
    resumed.state.courses.find((x: { id: string }) => x.id === c.resource)
      .activities[0].id,
  ).toBe(activity.id);
  const graded = await command(request, "attempt", c.resource, "a");
  const saved = graded.state.courses.find(
    (x: { id: string }) => x.id === c.resource,
  );
  expect(saved.evidence).toHaveLength(1);
  expect(saved.reviews).toHaveLength(1);
  await command(request, "delete", c.resource);
});
test("goal: assistance → feedback → goal revision preserves evidence", async ({
  request,
}) => {
  const d = await command(
    request,
    "createDraft",
    undefined,
    "Learn a topic for work",
  );
  await command(request, "answerDraft", d.resource, "Start now", {
    version: 0,
  });
  const c = await command(request, "convert", d.resource);
  await command(request, "session", c.resource);
  await command(request, "hint", c.resource);
  const graded = await command(request, "attempt", c.resource, "a");
  const prior = graded.state.courses.find(
    (x: { id: string }) => x.id === c.resource,
  );
  expect(prior.evidence[0].assisted).toBe(true);
  const revised = await command(
    request,
    "goal",
    c.resource,
    "Use this for a new project",
    { intent: "goal" },
  );
  const current = revised.state.courses.find(
    (x: { id: string }) => x.id === c.resource,
  );
  expect(current.evidence).toEqual(prior.evidence);
  expect(current.goals).toHaveLength(2);
  await command(request, "delete", c.resource);
});
test("API rejects cross-origin mutations and malformed input", async ({
  request,
}) => {
  const foreign = await request.post("/api/v1/command", {
    headers: { Origin: "https://evil.example" },
    data: { action: "createDraft", text: "Bad origin" },
  });
  expect(foreign.status()).toBe(403);
  const invalid = await request.post("/api/v1/command", {
    headers: { Origin: origin },
    data: { action: "madeUp" },
  });
  expect(invalid.status()).toBe(400);
});
