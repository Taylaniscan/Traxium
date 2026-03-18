import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getCommandCenterData } from "@/lib/data";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);

    const data = await getCommandCenterData(user.organizationId, {
      categoryId: searchParams.get("categoryId") || undefined,
      businessUnitId: searchParams.get("businessUnitId") || undefined,
      buyerId: searchParams.get("buyerId") || undefined,
      plantId: searchParams.get("plantId") || undefined,
      supplierId: searchParams.get("supplierId") || undefined,
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load command center." },
      { status: 500 }
    );
  }
}