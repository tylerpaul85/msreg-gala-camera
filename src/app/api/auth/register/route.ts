import { NextResponse } from "next/server";
import { registerOrLoginGuest, isValidEmail } from "@/lib/db";
import { setSessionCookie } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { firstName, lastName, email } = body || {};

    if (!firstName || typeof firstName !== "string" || !firstName.trim()) {
      return NextResponse.json(
        { error: "Kindly provide your first name for the gala roll registry." },
        { status: 400 }
      );
    }

    if (!lastName || typeof lastName !== "string" || !lastName.trim()) {
      return NextResponse.json(
        { error: "Kindly provide your surname for the archival record." },
        { status: 400 }
      );
    }

    if (!email || typeof email !== "string" || !isValidEmail(email)) {
      return NextResponse.json(
        {
          error:
            "Invalid electronic mail address. A valid address is required to deliver your developed gallery at midnight.",
        },
        { status: 400 }
      );
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const { guest, isNew } = await registerOrLoginGuest(fullName, email);

    // Persist session token in secure HTTP-only cookie
    await setSessionCookie(guest.session_token);

    return NextResponse.json({
      success: true,
      isNew,
      guest: {
        id: guest.id,
        name: guest.name,
        email: guest.email,
        shots_remaining: guest.shots_remaining,
        session_token: guest.session_token,
      },
    });
  } catch (error: any) {
    console.error("Registration error:", error);
    return NextResponse.json(
      {
        error:
          "The registrar desk encountered a ledger error. Please present your cartridge details once more.",
      },
      { status: 500 }
    );
  }
}

