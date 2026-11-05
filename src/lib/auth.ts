import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export function devAuth() {
  return (
    process.env.ADA_DEV_AUTH === "true" && process.env.NODE_ENV !== "production"
  );
}
export function mockModel() {
  return (
    process.env.MOCK_MODEL === "true" && process.env.NODE_ENV !== "production"
  );
}
export async function supabase() {
  const jar = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new Error(
      "Configure Supabase URL and anon key to enable email sign-in.",
    );
  return createServerClient(url, key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (items) => {
        for (const { name, value, options } of items)
          jar.set(name, value, {
            ...options,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
          });
      },
    },
  });
}
export async function identity() {
  if (
    process.env.NODE_ENV === "production" &&
    (process.env.ADA_DEV_AUTH === "true" || process.env.MOCK_MODEL === "true")
  )
    throw new Error(
      "Development authentication and fake models must be disabled in production.",
    );
  if (devAuth())
    return {
      id: "00000000-0000-4000-8000-000000000001",
      email: "local-demo@ada.test",
    };
  const client = await supabase();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user)
    throw Object.assign(new Error("Please sign in to continue."), {
      status: 401,
    });
  return { id: data.user.id, email: data.user.email };
}

export function database() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("Configure the server-only Supabase service role key.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
