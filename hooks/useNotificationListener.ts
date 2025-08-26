"use client";

import useSWR from "swr";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Notification } from "@prisma/client";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useNotificationListener() {
  const { data: notifications } = useSWR<Notification[]>("/api/notifications", fetcher, {
    refreshInterval: 5000,
  });

  const seenIds = useRef<Set<string>>(new Set());

  // helper to mark as read
  const markAsRead = async (id: string, link?: string | null) => {
    await fetch("/api/notifications/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    if (link) {
      window.location.href = link;
    }
  };

  useEffect(() => {
    if (!notifications) return;

    const newNotifications = notifications.filter(
      (n) => !seenIds.current.has(n.id) && !n.read
    );

    newNotifications.forEach((n) => {
      seenIds.current.add(n.id);
      toast(n.title, {
        description: n.message,
        action: {
          label: "View",
          onClick: () => markAsRead(n.id, n.link || "/notifications"), // ✅ mark as read before navigating
        },
      });
    });
  }, [notifications]);
}
