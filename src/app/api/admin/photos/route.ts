import { NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { getAdminPhotos } from "@/lib/db";

export async function GET() {
  const isAuth = await checkAdminAuth();
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await getAdminPhotos();
  return NextResponse.json(data);
}

