import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { identity, supabase, devAuth, mockModel } from "@/lib/auth";
import { command, view, exportState } from "@/lib/service";
import { signInError, signInDiagnostic } from "@/lib/sign-in-error";
export const runtime = "nodejs";
function error(e: unknown, requestId: string) {
  const status =
    e instanceof z.ZodError || e instanceof SyntaxError
      ? 400
      : Number((e as { status?: number })?.status) || 500;
  return NextResponse.json(
    {
      error: {
        code:
          (e as { code?: string })?.code ||
          (status === 401
            ? "UNAUTHORIZED"
            : status === 409
              ? "CONFLICT"
              : status === 429
                ? "RATE_LIMIT"
                : status === 503
                  ? "MODEL_UNAVAILABLE"
                  : status === 400
                    ? "VALIDATION"
                    : "REQUEST_FAILED"),
        message:
          status === 500
            ? "Unable to complete this request. Check configuration and retry."
            : e instanceof Error
              ? e.message
              : "Request failed.",
        retryable: status >= 500 || status === 409 || status === 429,
      },
      requestId,
    },
    { status },
  );
}
export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const user = await identity();
    if (req.nextUrl.pathname.endsWith("/export"))
      return NextResponse.json(await exportState(user.id), {
        headers: {
          "Content-Disposition": 'attachment; filename="ada-export.json"',
          "Cache-Control": "no-store",
        },
      });
    return NextResponse.json(
      {
        state: await view(user.id),
        user,
        mode: { devAuth: devAuth(), mock: mockModel() },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return error(e, requestId);
  }
}
export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const expected = new URL(process.env.APP_BASE_URL || req.url).origin;
    if (req.headers.get("origin") !== expected)
      throw Object.assign(new Error("Origin check failed."), { status: 403 });
    if (!req.headers.get("content-type")?.includes("application/json"))
      throw Object.assign(new Error("JSON is required."), { status: 400 });
    if (Number(req.headers.get("content-length") || 0) > 24000)
      throw Object.assign(new Error("Request too large."), { status: 413 });
    const raw = await req.text();
    if (Buffer.byteLength(raw) > 24000)
      throw Object.assign(new Error("Request too large."), { status: 413 });
    const body = JSON.parse(raw);
    if (req.nextUrl.pathname.endsWith("/login")) {
      const email = z.string().email().max(254).parse(body.email);
      const client = await supabase();
      const { error: e } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: expected + "/auth/callback" },
      });
      if (e) {
        console.error(JSON.stringify(signInDiagnostic(e, requestId)));
        throw signInError(e);
      }
      return NextResponse.json({ ok: true });
    }
    const user = await identity();
    if (req.nextUrl.pathname.endsWith("/logout")) {
      if (!devAuth()) await (await supabase()).auth.signOut();
      return NextResponse.json({ ok: true });
    }
    if (req.nextUrl.pathname.endsWith("/delete-account")) {
      if (devAuth())
        throw Object.assign(
          new Error(
            "Local demo account deletion: remove work/data after stopping the server.",
          ),
          { status: 400 },
        );
      const client = await supabase();
      const { error: e } = await client.rpc("delete_own_account");
      if (e) throw new Error("Account deletion failed.");
      await client.auth.signOut();
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(await command(user.id, body));
  } catch (e) {
    return error(e, requestId);
  }
}
