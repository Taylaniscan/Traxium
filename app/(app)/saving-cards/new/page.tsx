import { SavingCardForm } from "@/components/saving-cards/saving-card-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireUser } from "@/lib/auth";
import { getReferenceData, getWorkspaceReadiness } from "@/lib/data";
import { captureException } from "@/lib/observability";

function formatSetupList(items: string[]) {
  if (!items.length) {
    return "";
  }

  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export default async function NewSavingCardPage() {
  const user = await requireUser();
  const [referenceData, workspaceReadiness] = await Promise.all([
    getReferenceData(user.organizationId),
    getWorkspaceReadiness(user.organizationId).catch((error) => {
      captureException(error, {
        event: "saving_cards.new.page.readiness_load_failed",
        route: "/saving-cards/new",
        organizationId: user.organizationId,
        userId: user.id,
        payload: {
          resource: "workspace_readiness",
          degradedRender: true,
          fallback: "new_saving_card_without_readiness",
        },
      });
      return null;
    }),
  ]);
  const missingCoreSetup = workspaceReadiness?.missingCoreSetup ?? [];
  const configuredCollections = workspaceReadiness?.masterData.filter((item) => item.ready).length ?? 0;

  return (
    <div className="space-y-8">
      <SectionHeading
        title="New Saving Card"
        subtitle="Build the sourcing case, assign ownership, and add financial assumptions without leaving the workflow."
      />

      {missingCoreSetup.length ? (
        <Card className="border-[rgba(37,99,235,0.2)] bg-[rgba(37,99,235,0.05)]">
          <CardHeader className="space-y-2">
            <CardTitle>First-card setup can stay inside this form</CardTitle>
            <CardDescription>
              Some shared master data is still missing, but that should not slow down first value. Buyers, suppliers, materials, categories, plants, and business units can all be created inline below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {missingCoreSetup.map((item) => (
                <span
                  key={item}
                  className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-medium text-[var(--foreground)]"
                >
                  {item}
                </span>
              ))}
            </div>
            <div className="text-sm text-[var(--foreground)]">
              <p>
                {configuredCollections} of {workspaceReadiness?.masterData.length ?? 0} core master-data collections already have records. Missing today:{" "}
                {formatSetupList(missingCoreSetup)}.
              </p>
              <p className="mt-2 text-[var(--muted-foreground)]">
                Stay in the saving card flow and create what you need inline first. Workspace cleanup and broader standardization can wait until after the first record is live.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <SavingCardForm
        mode="create"
        referenceData={referenceData}
        workspaceReadiness={workspaceReadiness ?? undefined}
      />
    </div>
  );
}
