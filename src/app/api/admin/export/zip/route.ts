import { NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { getAllOriginalsForZip } from "@/lib/db";
import JSZip from "jszip";

export async function GET() {
  const isAuth = await checkAdminAuth();
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const files = await getAllOriginalsForZip();
  const zip = new JSZip();

  for (const f of files) {
    zip.file(f.filename, f.buffer);
  }

  // Generate ZIP file as buffer
  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return new NextResponse(zipBuffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="msreg_gala_originals.zip"',
    },
  });
}

