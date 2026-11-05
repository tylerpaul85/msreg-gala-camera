import { cookies, headers } from "next/headers";
import { getGuestBySessionToken, GuestRecord } from "./db";

export const SESSION_COOKIE_NAME = "msreg_gala_session";

export async function getSessionToken(explicitToken?: string | null): Promise<string | null> {
  if (explicitToken && explicitToken.trim()) return explicitToken.trim();

  try {
    const headerStore = await headers();
    const headerToken = headerStore.get("x-session-token");
    if (headerToken && headerToken.trim()) return headerToken.trim();
  } catch {}

  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
    if (sessionCookie?.value) return sessionCookie.value;
  } catch {}

  return null;
}

export async function getCurrentGuest(explicitToken?: string | null): Promise<GuestRecord | null> {
  const token = await getSessionToken(explicitToken);
  if (!token) return null;
  return getGuestBySessionToken(token);
}

export async function setSessionCookie(sessionToken: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

