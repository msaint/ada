import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  command: vi.fn(),
  view: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  signInWithOtp: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  identity: mocks.identity,
  devAuth: () => false,
  mockModel: () => false,
  supabase: async () => ({
    auth: {
      getUser: mocks.getUser,
      updateUser: mocks.updateUser,
      signInWithOtp: mocks.signInWithOtp,
    },
  }),
}));
vi.mock("@/lib/service", () => ({
  command: mocks.command,
  view: mocks.view,
  exportState: vi.fn(),
}));
import { GET, POST } from "../src/app/api/v1/[...path]/route";
function request(path: string, body?: unknown) {
  return new NextRequest(
    "http://localhost:3001/api/v1/" + path,
    body
      ? {
          method: "POST",
          headers: {
            origin: "http://localhost:3001",
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        }
      : undefined,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_BASE_URL", "http://localhost:3001");
  mocks.updateUser.mockResolvedValue({ error: null });
  mocks.signInWithOtp.mockResolvedValue({ error: null });
});
describe("guest API", () => {
  it("serves an empty no-store home without creating an account", async () => {
    mocks.identity.mockRejectedValue({ status: 401 });
    const response = await GET(request("state"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      user: null,
      state: { courses: [] },
    });
    expect(mocks.view).not.toHaveBeenCalled();
  });
  it("passes the verified guest restriction to the service", async () => {
    mocks.identity.mockResolvedValue({ id: "guest", guest: true });
    mocks.command.mockResolvedValue({ state: {} });
    await POST(
      request("command", { action: "createDraft", text: "Astronomy" }),
    );
    expect(mocks.identity).toHaveBeenCalledWith(true);
    expect(mocks.command).toHaveBeenCalledWith(
      "guest",
      { action: "createDraft", text: "Astronomy" },
      true,
    );
  });
  it("links email to the current guest rather than creating a separate user", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "guest", is_anonymous: true } },
    });
    const response = await POST(
      request("login", { email: "learner@example.com", intent: "upgrade" }),
    );
    expect(response.status).toBe(200);
    expect(mocks.updateUser).toHaveBeenCalledWith(
      { email: "learner@example.com" },
      { emailRedirectTo: "http://localhost:3001/auth/callback" },
    );
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
  });
  it("uses the existing-account flow only when explicitly selected", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { is_anonymous: true } } });
    await POST(
      request("login", { email: "learner@example.com", intent: "signin" }),
    );
    expect(mocks.signInWithOtp).toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
  it("requires an account to export guest progress", async () => {
    mocks.identity.mockResolvedValue({ id: "guest", guest: true });
    const response = await GET(request("export"));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { code: "ACCOUNT_REQUIRED" },
    });
  });
});
