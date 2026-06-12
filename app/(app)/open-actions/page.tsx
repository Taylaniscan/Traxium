import { redirect } from "next/navigation";

// Open Actions has been merged into the Action Center (/command-center).
// Preserve the optional view filter when redirecting the legacy route.
export default async function OpenActionsPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string | string[] }>;
}) {
  const resolved = (await searchParams) ?? {};
  const rawView = Array.isArray(resolved.view) ? resolved.view[0] : resolved.view;
  redirect(rawView === "all" ? "/command-center?view=all" : "/command-center");
}
