import { describe, expect, it } from "vitest";
import { signInError, signInDiagnostic } from "../src/lib/sign-in-error";
describe("sign-in delivery errors", () => {
  it("identifies rate limits and preserves 429 semantics", () => {
    for (const provider of [
      { status: 429 },
      { code: "over_email_send_rate_limit" },
      { code: "over_request_rate_limit" },
    ]) {
      expect(signInError(provider)).toMatchObject({
        status: 429,
        code: "AUTH_EMAIL_RATE_LIMIT",
      });
      expect(signInError(provider).message).toContain("custom SMTP");
    }
  });
  it("distinguishes restricted delivery and disabled providers", () => {
    expect(signInError({ code: "email_address_not_authorized" }).code).toBe(
      "AUTH_EMAIL_RESTRICTED",
    );
    expect(signInError({ code: "email_provider_disabled" }).code).toBe(
      "AUTH_EMAIL_DISABLED",
    );
  });
  it("logs only bounded metadata and never raw provider messages", () => {
    const provider = {
      code: "unexpected_failure",
      status: 500,
      message: "SMTP secret or personal email",
    };
    expect(signInDiagnostic(provider, "request-1")).toEqual({
      event: "auth_email_send_failed",
      requestId: "request-1",
      providerCode: "unexpected_failure",
      providerStatus: 500,
    });
    expect(signInError(provider).message).not.toContain(provider.message);
    expect(
      signInDiagnostic({ code: "sensitive@example.com" }, "request-2")
        .providerCode,
    ).toBe("unknown");
  });
});
