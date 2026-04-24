"use client";

import { Bell, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ShellNotification = {
  id: string;
  title: string;
  message: string;
  href: string | null;
  read: boolean;
};

type NotificationPanelContentProps = {
  notifications: ShellNotification[];
  unreadCount: number;
  activeNotificationId?: string | null;
  markingAllAsRead?: boolean;
  onSelectNotification?: (notification: ShellNotification) => void;
  onMarkAllAsRead?: () => void;
};

async function postNotificationAction(body: Record<string, unknown>) {
  const response = await fetch("/api/notifications", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return response.ok;
}

export function NotificationPanelContent({
  notifications,
  unreadCount,
  activeNotificationId = null,
  markingAllAsRead = false,
  onSelectNotification,
  onMarkAllAsRead,
}: NotificationPanelContentProps) {
  return (
    <div className="w-[360px] rounded-2xl border border-[var(--border)] bg-white shadow-[0_20px_50px_rgba(15,23,42,0.12)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">Notifications</p>
          <p className="text-xs text-[var(--muted-foreground)]">
            {notifications.length
              ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
              : "No workflow updates yet"}
          </p>
        </div>
        {unreadCount > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onMarkAllAsRead}
            disabled={markingAllAsRead}
            className="h-8 px-2 text-xs"
          >
            <CheckCheck className="mr-1 h-3.5 w-3.5" />
            Mark all read
          </Button>
        ) : null}
      </div>

      <div className="max-h-[420px] overflow-y-auto p-2">
        {notifications.length ? (
          <div className="space-y-2">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => onSelectNotification?.(notification)}
                className={cn(
                  "w-full rounded-xl border px-3 py-3 text-left transition",
                  notification.read
                    ? "border-[var(--border)] bg-white text-[var(--foreground)] hover:bg-[var(--muted)]/35"
                    : "border-[var(--primary)]/20 bg-[var(--primary)]/5 text-[var(--foreground)] hover:bg-[var(--primary)]/10"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {notification.title}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                      {notification.message}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "mt-0.5 inline-flex h-2.5 w-2.5 flex-shrink-0 rounded-full",
                      notification.read ? "bg-[var(--border)]" : "bg-[var(--primary)]"
                    )}
                    aria-hidden="true"
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                  <span>{notification.read ? "Read" : "Unread"}</span>
                  {activeNotificationId === notification.id ? <span>Opening…</span> : null}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-6 text-sm text-[var(--muted-foreground)]">
            High-value workflow updates will appear here as phase approvals, invitation acceptance, and finance lock changes happen.
          </div>
        )}
      </div>
    </div>
  );
}

export function NotificationBell({
  notifications,
  unreadCount,
}: {
  notifications: ShellNotification[];
  unreadCount: number;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ShellNotification[]>(notifications);
  const [localUnreadCount, setLocalUnreadCount] = useState(unreadCount);
  const [activeNotificationId, setActiveNotificationId] = useState<string | null>(null);
  const [markingAllAsRead, setMarkingAllAsRead] = useState(false);

  useEffect(() => {
    setItems(notifications);
    setLocalUnreadCount(unreadCount);
  }, [notifications, unreadCount]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        event.target instanceof Node &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  async function handleSelectNotification(notification: ShellNotification) {
    const previousItems = items;
    const previousUnreadCount = localUnreadCount;

    if (!notification.read) {
      setItems((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, read: true } : item
        )
      );
      setLocalUnreadCount((current) => Math.max(0, current - 1));
    }

    setActiveNotificationId(notification.id);

    try {
      if (!notification.read) {
        const succeeded = await postNotificationAction({
          notificationId: notification.id,
        });

        if (!succeeded) {
          setItems(previousItems);
          setLocalUnreadCount(previousUnreadCount);
        }
      }
    } finally {
      setActiveNotificationId(null);
      setOpen(false);

      if (notification.href) {
        router.push(notification.href);
      }
    }
  }

  async function handleMarkAllAsRead() {
    const previousItems = items;
    const previousUnreadCount = localUnreadCount;

    setItems((current) => current.map((item) => ({ ...item, read: true })));
    setLocalUnreadCount(0);
    setMarkingAllAsRead(true);

    try {
      const succeeded = await postNotificationAction({
        markAll: true,
      });

      if (!succeeded) {
        setItems(previousItems);
        setLocalUnreadCount(previousUnreadCount);
      }
    } finally {
      setMarkingAllAsRead(false);
    }
  }

  const unreadBadge = localUnreadCount > 99 ? "99+" : String(localUnreadCount);

  return (
    <div className="relative" ref={containerRef}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="Notifications"
        className="relative h-10 w-10 rounded-full"
        onClick={() => setOpen((current) => !current)}
      >
        <Bell className="h-4 w-4" />
        {localUnreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--primary)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {unreadBadge}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute right-0 top-12 z-50">
          <NotificationPanelContent
            notifications={items}
            unreadCount={localUnreadCount}
            activeNotificationId={activeNotificationId}
            markingAllAsRead={markingAllAsRead}
            onSelectNotification={handleSelectNotification}
            onMarkAllAsRead={handleMarkAllAsRead}
          />
        </div>
      ) : null}
    </div>
  );
}
