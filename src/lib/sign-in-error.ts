type ProviderError = { code?: string; status?: number };

// Do not forward provider messages: they can contain addresses or SMTP details.
export function signInError(provider: ProviderError) {
  const code = provider.code || "unknown";
  if (
    code === "email_exists" ||
    code === "user_already_exists" ||
    code === "identity_already_exists"
  ) {
    return Object.assign(
      new Error(
        "This email already has an account. Choose Sign in below to open it.",
      ),
      { status: 409, code: "AUTH_EMAIL_EXISTS" },
    );
  }
  if (
    provider.status === 429 ||
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit"
  ) {
    return Object.assign(
      new Error(
        "The sign-in email limit has been reached. Wait before trying again. If this continues, configure custom SMTP in Supabase Authentication.",
      ),
      { status: 429, code: "AUTH_EMAIL_RATE_LIMIT" },
    );
  }
  if (code === "email_address_not_authorized") {
    return Object.assign(
      new Error(
        "Sign-in email delivery is restricted by the current email provider. Configure custom SMTP in Supabase Authentication.",
      ),
      { status: 503, code: "AUTH_EMAIL_RESTRICTED" },
    );
  }
  if (
    code === "email_provider_disabled" ||
    code === "otp_disabled" ||
    code === "signup_disabled"
  ) {
    return Object.assign(
      new Error(
        "Email sign-in is disabled or restricted. Check Supabase Authentication provider settings.",
      ),
      { status: 503, code: "AUTH_EMAIL_DISABLED" },
    );
  }
  return Object.assign(
    new Error(
      "Supabase could not send the sign-in email. Check its Auth logs and SMTP configuration.",
    ),
    { status: 503, code: "AUTH_EMAIL_SEND_FAILED" },
  );
}

export function signInDiagnostic(provider: ProviderError, requestId: string) {
  return {
    event: "auth_email_send_failed",
    requestId,
    providerCode:
      provider.code && /^[a-z0-9_]{1,80}$/.test(provider.code)
        ? provider.code
        : "unknown",
    providerStatus:
      typeof provider.status === "number" ? provider.status : null,
  };
}
