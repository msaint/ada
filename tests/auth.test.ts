import { beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({
  getUser: vi.fn(),
  signInAnonymously: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: vi.fn() }),
}));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth }) }));
import { identity } from "../src/lib/auth";
beforeEach(() => {
  vi.stubEnv("ADA_DEV_AUTH", "false");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-key");
  vi.clearAllMocks();
});
describe("guest identity", () => {
  it("does not create an anonymous user when browsing", async () => {
    auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { status: 401 },
    });
    await expect(identity()).rejects.toMatchObject({ status: 401 });
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });
  it("creates a guest only when a command needs an identity", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    auth.signInAnonymously.mockResolvedValue({
      data: { user: { id: "guest-id" } },
      error: null,
    });
    expect(await identity(true)).toMatchObject({ id: "guest-id", guest: true });
  });
  it("recognizes verified upgrades without changing ownership", async () => {
    auth.getUser.mockResolvedValue({
      data: { user: { id: "same-id", is_anonymous: true } },
      error: null,
    });
    expect(await identity(true)).toMatchObject({ id: "same-id", guest: true });
    auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: "same-id",
          is_anonymous: false,
          email: "learner@example.com",
        },
      },
      error: null,
    });
    expect(await identity(true)).toMatchObject({ id: "same-id", guest: false });
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });
  it("does not replace a session during an auth outage", async () => {
    auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { status: 503 },
    });
    await expect(identity(true)).rejects.toMatchObject({ status: 503 });
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });
  it("reports unavailable guest auth without exposing provider details", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    auth.signInAnonymously.mockResolvedValue({
      data: { user: null },
      error: { message: "private detail" },
    });
    await expect(identity(true)).rejects.toMatchObject({ status: 503 });
  });
});
