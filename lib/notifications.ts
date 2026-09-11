import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { resolveTenantScope } from "@/lib/tenant-scope";
import type { TenantContextSource } from "@/lib/types";

const notificationSelect = {
  id: true,
  title: true,
  message: true,
  href: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

export type NotificationFeedItem = Prisma.NotificationGetPayload<{
  select: typeof notificationSelect;
}>;

function buildNotificationScopeWhere(
  userId: string,
  context?: TenantContextSource,
  extraWhere: Prisma.NotificationWhereInput = {}
): Prisma.NotificationWhereInput {
  const organizationId = context
    ? resolveTenantScope(context).organizationId
    : null;

  if (!organizationId) {
    return {
      userId,
      ...extraWhere,
    };
  }

  return {
    userId,
    ...extraWhere,
    OR: [{ organizationId }, { organizationId: null }],
  };
}

export async function getNotificationFeedForUser(
  userId: string,
  context?: TenantContextSource,
  options?: {
    take?: number;
  }
) {
  const where = buildNotificationScopeWhere(userId, context);
  const take = options?.take ?? 10;

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      select: notificationSelect,
      orderBy: { createdAt: "desc" },
      take,
    }),
    prisma.notification.count({
      where: {
        ...where,
        readAt: null,
      },
    }),
  ]);

  return {
    items,
    unreadCount,
  };
}

export async function markNotificationRead(
  notificationId: string,
  userId: string,
  context?: TenantContextSource
) {
  const where = buildNotificationScopeWhere(userId, context, {
    id: notificationId,
  });

  await prisma.notification.updateMany({
    where: {
      ...where,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });

  return prisma.notification.findFirst({
    where,
    select: notificationSelect,
  });
}

export async function markAllNotificationsRead(
  userId: string,
  context?: TenantContextSource
) {
  const result = await prisma.notification.updateMany({
    where: {
      ...buildNotificationScopeWhere(userId, context),
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });

  return result.count;
}
