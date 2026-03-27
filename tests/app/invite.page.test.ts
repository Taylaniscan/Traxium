import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvitationStatus, OrganizationRole } from "@prisma/client";

const getInvitationByTokenMock = vi.hoisted(() => vi.fn());
const getInvitationReadErrorMock = vi.hoisted(() => vi.fn());
const invitationFlowMock = vi.hoisted(() =>
  vi.fn(({ mode }: { mode: "setup" | "accept" | null }) =>
    React.createElement("div", { "data-invitation-flow": mode ?? "none" }, `mode:${mode ?? "none"}`)
  )
);

vi.mock("@/lib/invitations", () => ({
  getInvitationByToken: getInvitationByTokenMock,
  getInvitationReadError: getInvitationReadErrorMock,
}));

vi.mock("@/components/invitations/invitation-flow", () => ({
  InvitationFlow: invitationFlowMock,
}));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import InvitePage from "@/app/invite/[token]/page";

function createInvitationRecord() {
  return {
    id: "invite-1",
    organizationId: "org-1",
    email: "new.user@example.com",
    role: OrganizationRole.MEMBER,
    token: "token-123",
    status: InvitationStatus.PENDING,
    expiresAt: new Date("2026-03-31T12:00:00.000Z"),
    invitedByUserId: "admin-user-1",
    createdAt: new Date("2026-03-24T12:00:00.000Z"),
    updatedAt: new Date("2026-03-24T12:00:00.000Z"),
    organization: {
      id: "org-1",
      name: "Atlas Procurement",
      slug: "atlas-procurement",
    },
    invitedBy: {
      id: "admin-user-1",
      name: "Admin User",
      email: "admin@example.com",
    },
  };
}

describe("invite page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getInvitationByTokenMock.mockResolvedValue(createInvitationRecord());
    getInvitationReadErrorMock.mockReturnValue(null);
  });

  it("sends a new invited user to the account setup flow instead of generic login", async () => {
    const page = await InvitePage({
      params: Promise.resolve({ token: "token-123" }),
      searchParams: Promise.resolve({ mode: "setup" }),
    });
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(invitationFlowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "token-123",
        mode: "setup",
        loginHref:
          "/login?next=%2Finvite%2Ftoken-123%3Fmode%3Daccept&email=new.user%40example.com&message=invite-sign-in",
      }),
      undefined
    );
    expect(markup).toContain("mode:setup");
  });

  it("defaults bare invitation links into the account setup flow", async () => {
    const page = await InvitePage({
      params: Promise.resolve({ token: "token-123" }),
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page as React.ReactElement);

    expect(invitationFlowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "token-123",
        mode: "setup",
      }),
      undefined
    );
    expect(markup).toContain("mode:setup");
  });
});
