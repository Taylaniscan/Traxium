import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { storeEvidenceFile } from "@/lib/uploads";

export async function POST(request: Request) {
  try {
    await requireUser();

    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File);

    if (!files.length) {
      return NextResponse.json(
        { error: "No files were uploaded." },
        { status: 400 }
      );
    }

    const uploaded = [];
    for (const file of files) {
      uploaded.push(await storeEvidenceFile(file));
    }

    return NextResponse.json({ files: uploaded });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Upload failed.",
      },
      { status: 401 }
    );
  }
}