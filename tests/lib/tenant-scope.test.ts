import { describe, expect, it } from "vitest";

import {
  buildTenantOwnedRelationWhere,
  buildTenantScopeWhere,
  hasTenantOwnership,
  resolveTenantScope,
} from "@/lib/tenant-scope";
import {
  DEFAULT_ORGANIZATION_ID,
  OTHER_ORGANIZATION_ID,
  createSessionUser,
} from "../helpers/security-fixtures";

describe("lib/tenant-scope", () => {
  it("does not resolve scoped helpers without an organization context", () => {
    expect(() => resolveTenantScope("")).toThrow("Organization context is required.");
    expect(() => buildTenantScopeWhere("")).toThrow("Organization context is required.");
  });

  it("builds tenant-scoped where clauses for the active organization context", () => {
    const user = createSessionUser();

    expect(buildTenantScopeWhere(user, { id: "card-1" })).toEqual({
      id: "card-1",
      organizationId: DEFAULT_ORGANIZATION_ID,
    });

    expect(buildTenantOwnedRelationWhere("savingCard", user, { id: "card-1" })).toEqual({
      savingCard: {
        is: {
          id: "card-1",
          organizationId: DEFAULT_ORGANIZATION_ID,
        },
      },
    });
  });

  it("returns false when a record belongs to a different organization", () => {
    const user = createSessionUser();

    expect(
      hasTenantOwnership(
        {
          organizationId: OTHER_ORGANIZATION_ID,
        },
        user
      )
    ).toBe(false);
  });
});
