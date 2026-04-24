export const dynamic = "force-dynamic";

import Link from "next/link";
import { SavingCardTable } from "@/components/saving-cards/saving-card-table";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireUser } from "@/lib/auth";
import { getPendingApprovals, getSavingCards, getWorkspaceReadiness } from "@/lib/data";
import { captureException } from "@/lib/observability";
import type { WorkspaceReadiness } from "@/lib/types";

type SavingCards = Awaited<ReturnType<typeof getSavingCards>>;
type PendingApprovals = Awaited<ReturnType<typeof getPendingApprovals>>;
type SavingCardsView = "all" | "mine" | "approvals";

function normalizeSavingCardsView(value?: string | string[]): SavingCardsView {
  const normalized = Array.isArray(value) ? value[0] : value;

  switch (normalized) {
    case "mine":
      return "mine";
    case "approvals":
      return "approvals";
    default:
      return "all";
  }
}

export default async function SavingCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const user = await requireUser();
  const resolvedSearchParams = await searchParams;
  const view = normalizeSavingCardsView(resolvedSearchParams.view);

  let cards: SavingCards = [];
  let workspaceReadiness: WorkspaceReadiness | null = null;
  let approvals: PendingApprovals = [];

  if (view === "approvals") {
    const [approvalsResult, readinessResult] = await Promise.allSettled([
      getPendingApprovals(user.id, user.organizationId),
      getWorkspaceReadiness(user.organizationId),
    ]);

    if (approvalsResult.status === "fulfilled") {
      approvals = approvalsResult.value;

      const approvalCardIds = [...new Set(approvals.map((approval) => approval.phaseChangeRequest.savingCardId))];

      try {
        cards = await getSavingCards(user.organizationId, {
          ids: approvalCardIds,
        });
      } catch (error) {
        captureException(error, {
          event: "saving_cards.page.cards_load_failed",
          route: "/saving-cards",
          organizationId: user.organizationId,
          userId: user.id,
          payload: {
            resource: "saving_cards",
            degradedRender: true,
            fallback: "empty_cards_list",
            view,
          },
        });
      }
    } else {
      captureException(approvalsResult.reason, {
        event: "saving_cards.page.approvals_load_failed",
        route: "/saving-cards",
        organizationId: user.organizationId,
        userId: user.id,
        payload: {
          resource: "pending_approvals",
          degradedRender: true,
          fallback: "empty_cards_list",
          view,
        },
      });
    }

    if (readinessResult.status === "fulfilled") {
      workspaceReadiness = readinessResult.value;
    } else {
      captureException(readinessResult.reason, {
        event: "saving_cards.page.readiness_load_failed",
        route: "/saving-cards",
        organizationId: user.organizationId,
        userId: user.id,
        payload: {
          resource: "workspace_readiness",
          degradedRender: true,
          fallback: "cards_without_readiness",
          view,
        },
      });
    }
  } else {
    const [cardsResult, readinessResult] = await Promise.allSettled([
      getSavingCards(
        user.organizationId,
        view === "mine"
          ? {
              stakeholderUserId: user.id,
            }
          : undefined
      ),
      getWorkspaceReadiness(user.organizationId),
    ]);

    if (cardsResult.status === "fulfilled") {
      cards = cardsResult.value;
    } else {
      captureException(cardsResult.reason, {
        event: "saving_cards.page.cards_load_failed",
        route: "/saving-cards",
        organizationId: user.organizationId,
        userId: user.id,
        payload: {
          resource: "saving_cards",
          degradedRender: true,
          fallback: "empty_cards_list",
          view,
        },
      });
    }

    if (readinessResult.status === "fulfilled") {
      workspaceReadiness = readinessResult.value;
    } else {
      captureException(readinessResult.reason, {
        event: "saving_cards.page.readiness_load_failed",
        route: "/saving-cards",
        organizationId: user.organizationId,
        userId: user.id,
        payload: {
          resource: "workspace_readiness",
          degradedRender: true,
          fallback: "cards_without_readiness",
          view,
        },
      });
    }
  }

  const viewOptions = [
    {
      label: "All Cards",
      href: "/saving-cards",
      active: view === "all",
    },
    {
      label: "My Cards",
      href: "/saving-cards?view=mine",
      active: view === "mine",
    },
    {
      label: "My Approvals",
      href: "/saving-cards?view=approvals",
      active: view === "approvals",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading title="Saving Cards" />
          <Link href="/saving-cards/new">
            <Button>Create Saving Card</Button>
          </Link>
      </div>
      <SavingCardTable
        cards={cards}
        readiness={workspaceReadiness}
        scope={view}
        viewOptions={viewOptions}
      />
    </div>
  );
}
