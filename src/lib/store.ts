import { mkdir, readFile, writeFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { devAuth, database } from "./auth";
import { initialState, type State } from "./schema";
export type Snapshot = { version: number; data: State };
const root = path.join(process.cwd(), "work", "data");
export class Conflict extends Error {
  status = 409;
  constructor() {
    super("This page changed in another tab. Refresh and try again.");
  }
}
export async function readState(owner: string): Promise<Snapshot> {
  if (devAuth()) {
    await mkdir(root, { recursive: true });
    try {
      return JSON.parse(
        await readFile(path.join(root, owner + ".json"), "utf8"),
      );
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      return { version: 0, data: initialState() };
    }
  }
  const client = database();
  const { data, error } = await client
    .from("learner_states")
    .select("version,data")
    .eq("owner_id", owner)
    .maybeSingle();
  if (error)
    throw new Error("Database unavailable. Check migrations and retry.");
  return data ?? { version: 0, data: initialState() };
}
export async function writeState(owner: string, snapshot: Snapshot) {
  if (devAuth()) {
    await mkdir(root, { recursive: true });
    const lock = path.join(root, owner + ".lock");
    try {
      await mkdir(lock);
    } catch {
      throw new Conflict();
    }
    try {
      const current = await readState(owner);
      if (current.version !== snapshot.version) throw new Conflict();
      const temp = path.join(root, owner + ".tmp");
      await writeFile(
        temp,
        JSON.stringify({ version: snapshot.version + 1, data: snapshot.data }),
      );
      await rename(temp, path.join(root, owner + ".json"));
    } finally {
      await rm(lock, { recursive: true, force: true });
    }
    return;
  }
  const client = database();
  const { data, error } = await client.rpc("save_learner_state", {
    requested_owner: owner,
    expected_version: snapshot.version,
    new_data: snapshot.data,
  });
  if (error) {
    if (error.message.includes("VERSION_CONFLICT")) throw new Conflict();
    throw new Error("Could not save your work. Please retry.");
  }
  if (data === null) throw new Conflict();
}
export async function reserveBudget(owner: string) {
  for (let i = 0; i < 5; i++) {
    const snapshot = await readState(owner);
    const b = snapshot.data.budget,
      day = new Date().toISOString().slice(0, 10),
      minute = Math.floor(Date.now() / 60000);
    const count = b.day === day ? b.count : 0,
      burst = b.minute === minute ? b.burst : 0;
    const burstLimit =
      process.env.ADA_TEST_MODE === "true" &&
      process.env.NODE_ENV === "development"
        ? 100
        : 12;
    if (count >= 100 || burst >= burstLimit)
      throw Object.assign(
        new Error("AI request limit reached. Please try again later."),
        { status: 429 },
      );
    snapshot.data.budget = { day, count: count + 1, minute, burst: burst + 1 };
    try {
      await writeState(owner, snapshot);
      return;
    } catch (e) {
      if (!(e instanceof Conflict) || i === 4) throw e;
    }
  }
}
