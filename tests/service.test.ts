import { beforeAll, describe, it, expect, vi } from "vitest";
import { learningModel } from "../src/lib/model";
import { command, view } from "../src/lib/service";
import { readState, writeState, Conflict } from "../src/lib/store";
import type { Command } from "../src/lib/service";
beforeAll(() => {
  process.env.ADA_DEV_AUTH = "true";
  process.env.MOCK_MODEL = "true";
});
const owner = () => crypto.randomUUID();
async function send(user: string, cmd: Command) {
  if (
    [
      "saveAnswer",
      "attempt",
      "hint",
      "explain",
      "next",
      "skip",
      "pause",
    ].includes(cmd.action) &&
    !cmd.activityId
  ) {
    const c = (await view(user)).courses.find((c) => c.id === cmd.resource);
    cmd = { ...cmd, activityId: c?.activities[c.current]?.id };
  }
  return command(user, { ...cmd, key: cmd.key || crypto.randomUUID() });
}
async function course(user: string, topic = "Unseen topic in development") {
  const d = await send(user, { action: "createDraft", text: topic });
  await send(user, {
    action: "answerDraft",
    resource: d.resource,
    text: "Start now",
    version: 0,
  });
  return send(user, { action: "convert", resource: d.resource });
}
describe("durable learning service", () => {
  it("converts exactly once, and retries do not create a second course", async () => {
    const user = owner(),
      key = crypto.randomUUID();
    const a = await send(user, {
      action: "createDraft",
      text: "A novel topic",
      key,
    });
    const b = await send(user, {
      action: "createDraft",
      text: "A novel topic",
      key,
    });
    expect(a.resource).toBe(b.resource);
    await send(user, {
      action: "answerDraft",
      resource: a.resource,
      text: "Start now",
      version: 0,
    });
    const first = await send(user, { action: "convert", resource: a.resource });
    const again = await send(user, { action: "convert", resource: a.resource });
    expect(first.resource).toBe(again.resource);
    expect((await view(user)).courses).toHaveLength(1);
  });
  it("stores exact resume, assistance, immutable evidence and a scheduled review", async () => {
    const user = owner(),
      c = await course(user);
    await send(user, { action: "session", resource: c.resource });
    await send(user, {
      action: "saveAnswer",
      resource: c.resource,
      text: "a",
      version: 0,
    });
    await send(user, { action: "hint", resource: c.resource });
    await send(user, { action: "pause", resource: c.resource });
    let saved = (await view(user)).courses[0];
    const activityId = saved.activities[0].id;
    expect(saved.activities[0].answer).toBe("a");
    await send(user, { action: "session", resource: c.resource });
    expect((await view(user)).courses[0].activities[0].id).toBe(activityId);
    const key = crypto.randomUUID();
    await send(user, {
      action: "attempt",
      resource: c.resource,
      text: "a",
      key,
    });
    await send(user, {
      action: "attempt",
      resource: c.resource,
      text: "a",
      key,
    });
    saved = (await view(user)).courses[0];
    expect(saved.evidence).toHaveLength(1);
    expect(saved.evidence[0].assisted).toBe(true);
    expect(saved.reviews).toHaveLength(1);
  });
  it("denies foreign IDs and course deletion removes its dependent state only", async () => {
    const user = owner(),
      a = await course(user),
      b = await course(user, "Another topic");
    await expect(
      send(owner(), { action: "delete", resource: a.resource }),
    ).rejects.toThrow("not found");
    await send(user, { action: "session", resource: a.resource });
    await send(user, { action: "attempt", resource: a.resource, text: "a" });
    await send(user, { action: "delete", resource: a.resource });
    const state = await view(user);
    expect(state.courses.map((c) => c.id)).toEqual([b.resource]);
    expect(state.drafts.some((d) => d.courseId === a.resource)).toBe(false);
  });
  it("rejects stale saves and illegal advancement", async () => {
    const user = owner(),
      c = await course(user);
    await send(user, { action: "session", resource: c.resource });
    await expect(
      send(user, { action: "next", resource: c.resource }),
    ).rejects.toThrow("feedback");
    await send(user, {
      action: "saveAnswer",
      resource: c.resource,
      text: "a",
      version: 0,
    });
    await expect(
      send(user, {
        action: "saveAnswer",
        resource: c.resource,
        text: "b",
        version: 0,
      }),
    ).rejects.toThrow("another tab");
  });
  it("versions the goal without discarding learning evidence", async () => {
    const user = owner(),
      c = await course(user);
    await send(user, { action: "session", resource: c.resource });
    await send(user, { action: "attempt", resource: c.resource, text: "a" });
    const before = (await view(user)).courses[0].evidence;
    await send(user, {
      action: "goal",
      resource: c.resource,
      text: "Apply this at work",
      intent: "goal",
    });
    const saved = (await view(user)).courses[0];
    expect(saved.goals).toHaveLength(2);
    expect(saved.intent).toBe("goal");
    expect(saved.evidence).toEqual(before);
  });
  it("compare-and-swap prevents overwriting concurrent updates", async () => {
    const user = owner(),
      a = await readState(user),
      b = await readState(user);
    await writeState(user, a);
    await expect(writeState(user, b)).rejects.toBeInstanceOf(Conflict);
  });
  it("preserves intake answers on provider failure and retries without duplication", async () => {
    const user = owner(),
      d = await send(user, {
        action: "createDraft",
        text: "A difficult topic",
      }),
      key = crypto.randomUUID();
    const spy = vi
      .spyOn(learningModel, "compile")
      .mockRejectedValueOnce(new Error("Provider timeout"));
    await expect(
      send(user, {
        action: "answerDraft",
        resource: d.resource,
        text: "Start now",
        version: 0,
        key,
      }),
    ).rejects.toThrow("timeout");
    const retried = await send(user, {
      action: "answerDraft",
      resource: d.resource,
      text: "Start now",
      version: 0,
      key,
    });
    expect(retried.state.drafts[0].answers).toHaveLength(1);
    const ready = await send(user, { action: "propose", resource: d.resource });
    expect(ready.state.drafts[0].proposal).toBeTruthy();
    spy.mockRestore();
  });
  it("rejects an old-tab answer after a new activity is presented", async () => {
    const user = owner(),
      c = await course(user);
    await send(user, { action: "session", resource: c.resource });
    const old = (await view(user)).courses[0].activities[0].id;
    await send(user, { action: "attempt", resource: c.resource, text: "a" });
    await send(user, { action: "next", resource: c.resource });
    await expect(
      send(user, {
        action: "attempt",
        resource: c.resource,
        text: "b",
        activityId: old,
      }),
    ).rejects.toThrow("another tab");
    expect((await view(user)).courses[0].evidence).toHaveLength(1);
  });
});

describe("guest course limits", () => {
  it("allows a complete first course, retries, and continued learning", async () => {
    const user = owner();
    const key = crypto.randomUUID();
    const draft = await command(
      user,
      { action: "createDraft", text: "Guest topic", key },
      true,
    );
    expect(
      (
        await command(
          user,
          { action: "createDraft", text: "Guest topic", key },
          true,
        )
      ).resource,
    ).toBe(draft.resource);
    await command(
      user,
      {
        action: "answerDraft",
        resource: draft.resource,
        text: "Start now",
        version: 0,
      },
      true,
    );
    const first = await command(
      user,
      { action: "convert", resource: draft.resource },
      true,
    );
    expect(
      (
        await command(
          user,
          { action: "convert", resource: draft.resource },
          true,
        )
      ).resource,
    ).toBe(first.resource);
    await command(user, { action: "session", resource: first.resource }, true);
    const current = (await view(user)).courses[0];
    await command(
      user,
      {
        action: "saveAnswer",
        resource: first.resource,
        activityId: current.activities[0].id,
        text: "a",
        version: 0,
      },
      true,
    );
    expect((await view(user)).courses[0].activities[0].answer).toBe("a");
    await expect(
      command(user, { action: "createDraft", text: "Second topic" }, true),
    ).rejects.toMatchObject({ status: 403, code: "ACCOUNT_REQUIRED" });
    await expect(
      command(user, { action: "delete", resource: first.resource }, true),
    ).rejects.toMatchObject({ code: "ACCOUNT_REQUIRED" });
    // Email upgrade keeps the same owner and removes the guest restriction.
    await command(user, { action: "createDraft", text: "Second topic" }, false);
    expect((await view(user)).courses[0].activities[0].answer).toBe("a");
  });
  it("blocks a second draft before conversion and does not spend AI budget", async () => {
    const user = owner();
    await command(user, { action: "createDraft", text: "First" }, true);
    const before = await readState(user);
    await expect(
      command(user, { action: "createDraft", text: "Second" }, true),
    ).rejects.toMatchObject({ code: "ACCOUNT_REQUIRED" });
    expect((await readState(user)).data.budget).toEqual(before.data.budget);
  });
  it("blocks conversion of a second pre-existing draft", async () => {
    const user = owner();
    const first = await send(user, { action: "createDraft", text: "First" });
    const second = await send(user, { action: "createDraft", text: "Second" });
    for (const d of [first, second])
      await send(user, {
        action: "answerDraft",
        resource: d.resource,
        text: "Start now",
        version: 0,
      });
    await command(user, { action: "convert", resource: first.resource }, true);
    await expect(
      command(user, { action: "convert", resource: second.resource }, true),
    ).rejects.toMatchObject({ code: "ACCOUNT_REQUIRED" });
  });
});
