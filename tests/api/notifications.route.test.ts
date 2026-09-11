import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAuthGuardJsonResponse,
  MockAuthGuardError,
} from "../helpers/security-fixtures";

const requireUserMock = vi.hoisted(() => vi.fn());
const createAuthGuardErrorResponseMock = vi.hoisted(() => vi.fn());
const getNotificationFeedForUserMock = vi.hoisted(() => vi.fn());
const markNotificationReadMock = vi.hoisted(() => vi.fn());
const markAllNotificationsReadMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireUser: requireUserMock,
  createAuthGuardErrorResponse: createAuthGuardErrorResponseMock,
}));

vi.mock("@/lib/notifications", () => ({
  getNotificationFeedForUser: getNotificationFeedForUserMock,
  markNotificationRead: markNotificationReadMock,
  markAllNotificationsRead: markAllNotificationsReadMock,
}));

import { GET, POST } from "@/app/api/notifications/route";

function createJsonRequest(body: unknown) {
  return new Request("http://localhost/api/notifications", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("notifications route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({
      id: "user-1",
      organizationId: "org-1",
    });
    createAuthGuardErrorResponseMock.mockImplementation(createAuthGuardJsonResponse);
    getNotificationFeedForUserMock.mockResolvedValue({
      unreadCount: 2,
      items: [
        {
          id: "notification-1",
          title: "Phase change approved",
          message: "Resin renegotiation moved to VALIDATED.",
          href: "/saving-cards/card-1",
          readAt: null,
          createdAt: new Date("2026-04-13T18:00:00.000Z"),
        },
      ],
    });
    markNotificationReadMock.mockResolvedValue({
      id: "notification-1",
      title: "Phase change approved",
      message: "Resin renegotiation moved to VALIDATED.",
      href: "/saving-cards/card-1",
      readAt: new Date("2026-04-13T18:05:00.000Z"),
      createdAt: new Date("2026-04-13T18:00:00.000Z"),
    });
    markAllNotificationsReadMock.mockResolvedValue(2);
  });

  it("returns the scoped notification feed", async () => {
    const response = await GET();

    expect(getNotificationFeedForUserMock).toHaveBeenCalledWith("user-1", "org-1");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      unreadCount: 2,
      notifications: [
        {
          id: "notification-1",
          title: "Phase change approved",
          message: "Resin renegotiation moved to VALIDATED.",
          href: "/saving-cards/card-1",
          read: false,
          createdAt: "2026-04-13T18:00:00.000Z",
        },
      ],
    });
  });

  it("marks a single notification as read", async () => {
    const response = await POST(
      createJsonRequest({
        notificationId: "notification-1",
      })
    );

    expect(markNotificationReadMock).toHaveBeenCalledWith(
      "notification-1",
      "user-1",
      "org-1"
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      notification: {
        id: "notification-1",
        title: "Phase change approved",
        message: "Resin renegotiation moved to VALIDATED.",
        href: "/saving-cards/card-1",
        read: true,
      },
    });
  });

  it("marks all notifications as read", async () => {
    const response = await POST(
      createJsonRequest({
        markAll: true,
      })
    );

    expect(markAllNotificationsReadMock).toHaveBeenCalledWith("user-1", "org-1");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      count: 2,
    });
  });

  it("returns 404 when the notification does not belong to the user", async () => {
    markNotificationReadMock.mockResolvedValueOnce(null);

    const response = await POST(
      createJsonRequest({
        notificationId: "missing-notification",
      })
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Notification not found.",
    });
  });

  it("returns auth guard JSON for unauthenticated requests", async () => {
    requireUserMock.mockRejectedValueOnce(
      new MockAuthGuardError(
        "Authenticated session is required.",
        401,
        "UNAUTHENTICATED"
      )
    );

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized.",
    });
  });
});
