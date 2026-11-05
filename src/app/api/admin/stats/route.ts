import { NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { getAdminStats } from "@/lib/db";

export async function GET() {
  const isAuth = await checkAdminAuth();
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stats = await getAdminStats();
  return NextResponse.json(stats);
}

