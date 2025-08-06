"use client";

import useSWR from "swr";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Notification } from "@prisma/client";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useNotificationListener() {
  const { data: notifications } = useSWR<Notification[]>("/api/notifications", fetcher, {
    refreshInterval: 10000, // poll every 10s
  });

  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!notifications) return;

    const newNotifications = notifications.filter((n) => {
      return !seenIds.current.has(n.id) && !n.read;
    });

    newNotifications.forEach((n) => {
      seenIds.current.add(n.id);
      toast(n.title, {
        description: n.message,
        action: {
          label: "View",
          onClick: () => window.location.href = n.link || "/notifications",
        },
      });
    });
  }, [notifications]);
}
