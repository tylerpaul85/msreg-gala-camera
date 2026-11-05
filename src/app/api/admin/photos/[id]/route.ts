import { NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { deletePhoto } from "@/lib/db";

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await props.params;
  const success = await deletePhoto(id);

  if (!success) {
    return NextResponse.json(
      { error: "Could not locate or remove the requested photograph plate." },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, deletedId: id });
}

