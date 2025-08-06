"use client";

import useSWR from "swr";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Notification = {
  id: string;
  title: string;
  message: string;
  link?: string;
  read: boolean;
};

export default function NotificationDropdown() {
  const {
    data: notifications = []
  } = useSWR<Notification[]>("/api/notifications", {
    refreshInterval: 5000, // check every 5 seconds
  });

  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (notifications.length === 0) return;

    const newUnread = notifications.filter((n) => !n.read && !seenIds.current.has(n.id));

    if (newUnread.length > 0) {
      newUnread.forEach((n) => {
        toast(n.title, {
          description: n.message,
          action: n.link
            ? {
                label: "View",
                onClick: () => (window.location.href = n.link!),
              }
            : undefined,
        });
        seenIds.current.add(n.id);
      });
    }
  }, [notifications]);

  return (
    <div className="relative">
      <Button variant="ghost" size="icon">
        <Bell className="h-5 w-5" />
        {notifications.some((n) => !n.read) && (
          <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full" />
        )}
      </Button>

      <div className="absolute right-0 mt-2 w-96 bg-white shadow-lg rounded-lg z-50 p-2 space-y-2">
        {notifications.length === 0 ? (
          <p className="text-muted-foreground">No notifications yet.</p>
        ) : (
          notifications.slice(0, 5).map((n) => (
            <Link
              key={n.id}
              href={n.link || "#"}
              className="block p-2 hover:bg-muted rounded"
            >
              <p className="font-semibold">{n.title}</p>
              <p className="text-sm text-muted-foreground">{n.message}</p>
            </Link>
          ))
        )}
        <Link href="/notifications" className="text-sm text-blue-600 hover:underline block text-right">
          View all
        </Link>
      </div>
    </div>
  );
}
