import { NextResponse } from "next/server";

import { auditEventTypes, writeAuditEvent } from "@/lib/audit";
import { createAuthGuardErrorResponse, requireUser } from "@/lib/auth";
import { getSavingCards, getWorkspaceReadiness } from "@/lib/data";
import { buildControllerWorkbookModel } from "@/lib/export/controller-workbook";
import { renderControllerWorkbookXlsx } from "@/lib/export/controller-workbook-xlsx";
import { prisma } from "@/lib/prisma";
import {
  createRateLimitErrorResponse,
  enforceRateLimit,
  RateLimitExceededError,
} from "@/lib/rate-limit";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function GET(request: Request) {
  try {
    const user = await requireUser({ redirectTo: null });
    await enforceRateLimit({
      policy: "dataExport",
      request,
      userId: user.id,
      organizationId: user.organizationId,
      action: "saving-cards.export",
    });

    const [cards, workspaceReadiness] = await Promise.all([
      getSavingCards(user),
      getWorkspaceReadiness(user),
    ]);
    const generatedAt = new Date();
    const model = buildControllerWorkbookModel({
      cards,
      generatedAt,
      workspaceReadiness,
    });
    const buffer = renderControllerWorkbookXlsx({
      model,
      workspaceName: workspaceReadiness.workspace.name,
    });
    const exportDate = generatedAt.toISOString().slice(0, 10);
    const fileName = `traxium-${workspaceReadiness.workspace.slug}-controller-review-${exportDate}.xlsx`;

    await writeAuditEvent(prisma, {
      organizationId: user.organizationId,
      actorUserId: user.id,
      eventType: auditEventTypes.CONTROLLER_WORKBOOK_EXPORTED,
      detail: `Controller-review workbook exported with ${cards.length} saving cards.`,
      payload: {
        cardCount: cards.length,
        activeCardCount: model.reconciliation.activeCardCount,
        evidenceCoveragePercent: model.reconciliation.evidenceCoveragePercent,
        reconciliationDifference: model.reconciliation.difference,
        sheetNames: [
          "Portfolio Summary",
          "Saving Cards",
          "Data Dictionary",
          "Import Template",
          "Evidence Summary",
        ],
      },
    });

    return new Response(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    const authResponse = createAuthGuardErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    if (error instanceof RateLimitExceededError) {
      return createRateLimitErrorResponse(error);
    }

    return jsonError(
      error instanceof Error ? error.message : "Export failed.",
      500
    );
  }
}
