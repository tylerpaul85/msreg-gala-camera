import { NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { setRevealed } from "@/lib/db";

export async function POST(request: Request) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { revealed } = await request.json();
    const updated = await setRevealed(Boolean(revealed));

    return NextResponse.json({ success: true, revealed: updated });
  } catch (err: any) {
    console.error("Failed to update reveal setting:", err);
    return NextResponse.json(
      { error: "Could not adjust the gala darkroom reveal seal." },
      { status: 500 }
    );
  }
}

