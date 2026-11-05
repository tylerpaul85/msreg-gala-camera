import { NextResponse } from "next/server";
import { getPublicGalleryPhotos } from "@/lib/db";

export async function GET() {
  try {
    const data = await getPublicGalleryPhotos();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Gallery fetch error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve gala vault exposures." },
      { status: 500 }
    );
  }
}

