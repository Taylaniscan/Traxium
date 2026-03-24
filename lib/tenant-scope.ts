import { resolveTenantContext } from "@/lib/organizations";
import type {
  TenantContextSource,
  TenantOwnedRelationWhere,
  TenantOwnershipRecord,
  TenantScope,
  TenantScopedWhereInput,
} from "@/lib/types";

export function resolveTenantScope(context: TenantContextSource): TenantScope {
  return resolveTenantContext(context);
}

export function buildTenantScopeWhere<
  TWhere extends Record<string, unknown> = Record<string, never>,
>(
  context: TenantContextSource,
  where?: TWhere
): TenantScopedWhereInput<TWhere> {
  const scope = resolveTenantScope(context);

  return {
    ...(where ?? ({} as TWhere)),
    organizationId: scope.organizationId,
  } as TenantScopedWhereInput<TWhere>;
}

export function buildTenantOwnedRelationWhere<
  TRelationName extends string,
  TWhere extends Record<string, unknown> = Record<string, never>,
>(
  relationName: TRelationName,
  context: TenantContextSource,
  where?: TWhere
): TenantOwnedRelationWhere<TRelationName, TWhere> {
  return {
    [relationName]: {
      is: buildTenantScopeWhere(context, where),
    },
  } as TenantOwnedRelationWhere<TRelationName, TWhere>;
}

export function hasTenantOwnership(
  record: TenantOwnershipRecord | null | undefined,
  context: TenantContextSource
) {
  if (!record?.organizationId) {
    return false;
  }

  return record.organizationId === resolveTenantScope(context).organizationId;
}
