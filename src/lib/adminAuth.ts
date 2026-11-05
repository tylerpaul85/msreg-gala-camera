import { cookies } from "next/headers";
import crypto from "crypto";

const ADMIN_COOKIE_NAME = "msreg_admin_session";

function getExpectedToken(): string | null {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) return null;
  return crypto
    .createHash("sha256")
    .update(`${secret}:msreg_admin_vault_salt`)
    .digest("hex");
}

export async function checkAdminAuth(): Promise<boolean> {
  const expectedToken = getExpectedToken();
  if (!expectedToken) return false;

  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return false;

  return token === expectedToken;
}

export async function setAdminSession(inputPassword: string): Promise<boolean> {
  const adminSecret = process.env.ADMIN_PASSWORD;
  if (!adminSecret || !inputPassword) return false;

  if (inputPassword !== adminSecret) {
    return false;
  }

  const sessionHash = getExpectedToken();
  if (!sessionHash) return false;

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, sessionHash, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return true;
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
}
