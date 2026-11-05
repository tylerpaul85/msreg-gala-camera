import { NextResponse } from "next/server";
import { getCurrentGuest } from "@/lib/session";

export async function GET() {
  try {
    const guest = await getCurrentGuest();

    if (!guest) {
      return NextResponse.json({ authenticated: false, guest: null });
    }

    return NextResponse.json({
      authenticated: true,
      guest: {
        id: guest.id,
        name: guest.name,
        email: guest.email,
        shots_remaining: guest.shots_remaining,
        session_token: guest.session_token,
      },
    });
  } catch (error) {
    console.error("Session check error:", error);
    return NextResponse.json(
      { authenticated: false, guest: null },
      { status: 500 }
    );
  }
}
