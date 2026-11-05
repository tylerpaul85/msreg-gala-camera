import { cookies } from "next/headers";

const ADMIN_COOKIE_NAME = "msreg_admin_session";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "gala1974";

export async function checkAdminAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return false;
  return token === ADMIN_PASSWORD;
}

export async function setAdminSession(password: string): Promise<boolean> {
  if (password !== ADMIN_PASSWORD) {
    return false;
  }
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, ADMIN_PASSWORD, {
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

