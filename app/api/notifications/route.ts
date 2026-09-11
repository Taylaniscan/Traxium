import { NextResponse } from "next/server";
import { z } from "zod";

import { createAuthGuardErrorResponse, requireUser } from "@/lib/auth";
import {
  getNotificationFeedForUser,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications";

const notificationActionSchema = z
  .object({
    notificationId: z.string().trim().min(1).optional(),
    markAll: z.boolean().optional(),
  })
  .refine(
    (value) => value.markAll === true || Boolean(value.notificationId),
    {
      message: "Provide notificationId or markAll.",
      path: ["notificationId"],
    }
  );

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

async function readJsonBody(request: Request) {
  try {
    return { ok: true as const, data: await request.json() };
  } catch {
    return {
      ok: false as const,
      response: jsonError("Request body must be valid JSON.", 400),
    };
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET() {
  try {
    const user = await requireUser({ redirectTo: null });
    const feed = await getNotificationFeedForUser(user.id, user.organizationId);

    return NextResponse.json({
      unreadCount: feed.unreadCount,
      notifications: feed.items.map((item) => ({
        id: item.id,
        title: item.title,
        message: item.message,
        href: item.href ?? null,
        read: Boolean(item.readAt),
        createdAt: item.createdAt,
      })),
    });
  } catch (error) {
    const authResponse = createAuthGuardErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    return jsonError(
      error instanceof Error ? error.message : "Notifications could not be loaded.",
      500
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser({ redirectTo: null });
    const body = await readJsonBody(request);

    if (!body.ok) {
      return body.response;
    }

    if (!isPlainObject(body.data)) {
      return jsonError("Request body must be a JSON object.", 400);
    }

    const payload = notificationActionSchema.safeParse(body.data);

    if (!payload.success) {
      return jsonError(
        payload.error.issues[0]?.message ?? "Notification action payload is invalid.",
        422
      );
    }

    if (payload.data.markAll) {
      const count = await markAllNotificationsRead(user.id, user.organizationId);
      return NextResponse.json({ success: true, count });
    }

    const notification = await markNotificationRead(
      payload.data.notificationId!,
      user.id,
      user.organizationId
    );

    if (!notification) {
      return jsonError("Notification not found.", 404);
    }

    return NextResponse.json({
      success: true,
      notification: {
        id: notification.id,
        title: notification.title,
        message: notification.message,
        href: notification.href ?? null,
        read: Boolean(notification.readAt),
      },
    });
  } catch (error) {
    const authResponse = createAuthGuardErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    return jsonError(
      error instanceof Error ? error.message : "Notification action failed.",
      500
    );
  }
}
