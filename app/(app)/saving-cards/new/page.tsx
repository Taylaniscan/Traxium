import Link from "next/link";
import { SavingCardForm } from "@/components/saving-cards/saving-card-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireUser } from "@/lib/auth";
import { getReferenceData, getWorkspaceReadiness } from "@/lib/data";

const SERVER_OUTLINE_BUTTON_SMALL_CLASS =
  "inline-flex h-8 items-center justify-center rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

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
      console.log("Workspace readiness could not be loaded:", error);
      return null;
    }),
  ]);
  const missingCoreSetup = workspaceReadiness?.missingCoreSetup ?? [];
  const configuredCollections = workspaceReadiness?.masterData.filter((item) => item.ready).length ?? 0;

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <SectionHeading title="New Saving Card" />
        <p className="max-w-3xl text-[15px] leading-7 text-[var(--muted-foreground)]">
          Build the sourcing case, assign ownership, and add financial assumptions without leaving the workflow.
        </p>
      </div>

      {missingCoreSetup.length ? (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardHeader className="space-y-2">
            <CardTitle>Workspace setup is still in progress</CardTitle>
            <CardDescription>
              Some shared master data is still missing. You can keep moving by creating records inline in the form, then standardize them in Settings for the rest of the workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {missingCoreSetup.map((item) => (
                <span
                  key={item}
                  className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900"
                >
                  {item}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-amber-950">
              <p>
                {configuredCollections} of {workspaceReadiness?.masterData.length ?? 0} core master-data collections already have records. Missing today:{" "}
                {formatSetupList(missingCoreSetup)}.
              </p>
              <Link href="/admin" className={SERVER_OUTLINE_BUTTON_SMALL_CLASS}>
                Open Settings
              </Link>
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
