import { invalidateScopedCache } from "@/lib/cache";
import { resolveTenantScope } from "@/lib/tenant-scope";
import type { TenantContextSource } from "@/lib/types";

export const WORKSPACE_READINESS_CACHE_NAMESPACE = "workspace-readiness";
export const DASHBOARD_DATA_CACHE_NAMESPACE = "dashboard-data";
export const WORKSPACE_READINESS_CACHE_TTL_MS = 1_500;
export const DASHBOARD_DATA_CACHE_TTL_MS = 1_000;

type PortfolioSurfaceInvalidationOptions = {
  dashboard?: boolean;
  workspaceReadiness?: boolean;
};

export function invalidatePortfolioSurfaceCaches(
  context: TenantContextSource,
  options: PortfolioSurfaceInvalidationOptions = {}
) {
  const { organizationId } = resolveTenantScope(context);
  const invalidateDashboard = options.dashboard ?? true;
  const invalidateWorkspaceReadiness = options.workspaceReadiness ?? true;

  if (invalidateDashboard) {
    invalidateScopedCache({
      namespace: DASHBOARD_DATA_CACHE_NAMESPACE,
      organizationId,
    });
  }

  if (invalidateWorkspaceReadiness) {
    invalidateScopedCache({
      namespace: WORKSPACE_READINESS_CACHE_NAMESPACE,
      organizationId,
    });
  }
}
