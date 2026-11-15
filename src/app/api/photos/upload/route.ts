import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "The MSREG Client Appreciation Gala has concluded. The camera feature has been sealed and all exposures have been developed in the gallery.",
    },
    { status: 403 }
  );
}

