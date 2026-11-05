import { NextResponse } from "next/server";
import { getCurrentGuest } from "@/lib/session";
import { getGuestPhotos } from "@/lib/db";

export async function GET() {
  try {
    const guest = await getCurrentGuest();

    if (!guest) {
      return NextResponse.json(
        { error: "Unauthenticated cartridge." },
        { status: 401 }
      );
    }

    const photos = await getGuestPhotos(guest.id);

    return NextResponse.json({
      shots_remaining: guest.shots_remaining,
      photos,
    });
  } catch (error) {
    console.error("Fetch photos error:", error);
    return NextResponse.json(
      { error: "Failed to read developed plates." },
      { status: 500 }
    );
  }
}
