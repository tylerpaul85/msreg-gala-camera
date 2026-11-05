import { NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { getAllGuestsForExport } from "@/lib/db";

export async function GET() {
  const isAuth = await checkAdminAuth();
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const guests = await getAllGuestsForExport();

  // Construct CSV
  const header = ["Full Name", "Email Address", "Exposures Taken (out of 8)", "Registration Date"];
  const rows = guests.map((g) => [
    `"${g.name.replace(/"/g, '""')}"`,
    `"${g.email.replace(/"/g, '""')}"`,
    g.shots_taken,
    `"${new Date(g.created_at).toLocaleString()}"`,
  ]);

  const csvContent = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="msreg_gala_guests.csv"',
    },
  });
}

