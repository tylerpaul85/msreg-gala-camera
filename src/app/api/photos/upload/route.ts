import { NextResponse } from "next/server";
import { getCurrentGuest } from "@/lib/session";
import { uploadAndRecordPhoto } from "@/lib/db";

export async function POST(request: Request) {
  try {
    // 1. Authenticate guest via session token cookie
    const guest = await getCurrentGuest();

    if (!guest) {
      return NextResponse.json(
        {
          error:
            "No active camera cartridge identified. Please register at the entrance desk.",
        },
        { status: 401 }
      );
    }

    // 2. Strict server-side verification of remaining shots
    if (guest.shots_remaining <= 0) {
      return NextResponse.json(
        {
          error:
            "All eight exposures have been exhausted. Your roll is complete and will develop at 8:00 PM CST.",
          shots_remaining: 0,
        },
        { status: 403 }
      );
    }

    // 3. Parse multipart form data
    const formData = await request.formData();
    const photoFile = formData.get("photo") as File | null;
    const caption = (formData.get("caption") as string | null) || null;

    if (!photoFile) {
      return NextResponse.json(
        { error: "No photographic plate received by the darkroom." },
        { status: 400 }
      );
    }

    // Check mime type
    if (!photoFile.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Unrecognized photographic format. Emulsion rejected." },
        { status: 400 }
      );
    }

    const arrayBuffer = await photoFile.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // 4. Save photo and decrement exposure quota atomically
    const { guest: updatedGuest, photo } = await uploadAndRecordPhoto({
      guestId: guest.id,
      fileBuffer,
      mimeType: photoFile.type || "image/jpeg",
      caption,
    });

    return NextResponse.json({
      success: true,
      shots_remaining: updatedGuest.shots_remaining,
      photo: {
        id: photo.id,
        exposure_number: photo.exposure_number,
        preview_url: photo.preview_url,
        caption: photo.caption,
        created_at: photo.created_at,
      },
    });
  } catch (error: any) {
    console.error("Photo upload darkroom error:", error);

    if (error.message === "EXHAUSTED_ROLL") {
      return NextResponse.json(
        {
          error:
            "Exposures exhausted. Your 8-shot roll has concluded and will develop at 8:00 PM CST.",
          shots_remaining: 0,
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        error:
          "The chemical development chamber encountered a mechanical snag. Please attempt this exposure again.",
      },
      { status: 500 }
    );
  }
}

