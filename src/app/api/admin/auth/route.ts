import { NextResponse } from "next/server";
import { checkAdminAuth, setAdminSession, clearAdminSession } from "@/lib/adminAuth";

export async function GET() {
  const isAuth = await checkAdminAuth();
  return NextResponse.json({ authenticated: isAuth });
}

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    const success = await setAdminSession(password || "");
    if (!success) {
      return NextResponse.json(
        { error: "Incorrect administrative seal key." },
        { status: 401 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}

export async function DELETE() {
  await clearAdminSession();
  return NextResponse.json({ success: true });
}

