import { NextResponse } from "next/server";

import { auditEventTypes, writeAuditEvent } from "@/lib/audit";
import { createAuthGuardErrorResponse, requireUser } from "@/lib/auth";
import { getSavingCards, getWorkspaceReadiness } from "@/lib/data";
import {
  buildControllerWorkbookModel,
  type ControllerActualsByCard,
} from "@/lib/export/controller-workbook";
import { renderControllerWorkbookXlsx } from "@/lib/export/controller-workbook-xlsx";
import { prisma } from "@/lib/prisma";
import { buildTenantOwnedRelationWhere } from "@/lib/tenant-scope";
import { toNumber } from "@/lib/utils/decimal";
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

    // Load per-card forecast/actual volume series for the actuals-reconciliation
    // sheet, tenant-scoped through the saving-card relation.
    const cardIds = cards.map((card) => card.id);
    const [forecasts, actualEntries] = cardIds.length
      ? await Promise.all([
          prisma.materialConsumptionForecast.findMany({
            where: buildTenantOwnedRelationWhere("savingCard", user.organizationId, {
              id: { in: cardIds },
            }),
            select: { savingCardId: true, period: true, forecastQty: true },
            orderBy: { period: "asc" },
          }),
          prisma.materialConsumptionActual.findMany({
            where: buildTenantOwnedRelationWhere("savingCard", user.organizationId, {
              id: { in: cardIds },
            }),
            select: {
              savingCardId: true,
              period: true,
              actualQty: true,
              invoiceRef: true,
            },
            orderBy: { period: "asc" },
          }),
        ])
      : [[], []];

    const actuals: ControllerActualsByCard = new Map();
    const ensureSeries = (cardId: string) => {
      let series = actuals.get(cardId);
      if (!series) {
        series = { forecasts: [], actuals: [] };
        actuals.set(cardId, series);
      }
      return series;
    };
    for (const forecast of forecasts) {
      ensureSeries(forecast.savingCardId).forecasts.push({
        period: forecast.period,
        forecastQty: toNumber(forecast.forecastQty),
      });
    }
    for (const actual of actualEntries) {
      ensureSeries(actual.savingCardId).actuals.push({
        period: actual.period,
        actualQty: toNumber(actual.actualQty),
        invoiceRef: actual.invoiceRef,
      });
    }

    const generatedAt = new Date();
    const model = buildControllerWorkbookModel({
      cards,
      generatedAt,
      workspaceReadiness,
      actuals,
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
          "Actuals Reconciliation",
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
