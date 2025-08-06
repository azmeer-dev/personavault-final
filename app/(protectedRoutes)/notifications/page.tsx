"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  recipientId: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  read: boolean;
  createdAt: string;
};

export default function NotificationsPage() {
  const { data: session, status } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/notifications")
        .then((res) => res.json())
        .then((data: Notification[]) => setNotifications(data));
    }
  }, [status]);

  const markAsRead = async (id: string, link?: string | null) => {
    await fetch("/api/notifications/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );

    if (link) {
      router.push(link);
    }
  };

  if (status === "loading") {
    return <p className="p-4">Loading...</p>;
  }

  if (!session?.user?.id) {
    return <p className="p-4">You must be signed in to view notifications.</p>;
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-3xl font-bold mb-6">Your Notifications</h1>

      {notifications.length === 0 ? (
        <p className="text-muted-foreground">You have no notifications.</p>
      ) : (
        <div className="space-y-4">
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => markAsRead(n.id, n.link)}
              className="w-full text-left"
            >
              <Card className={cn("transition hover:shadow-md", !n.read && "bg-muted")}>
                <CardHeader className="flex flex-row justify-between items-center">
                  <CardTitle className="text-lg">{n.title}</CardTitle>
                  {!n.read && <Badge variant="default">New</Badge>}
                </CardHeader>

                <CardContent className="text-muted-foreground">
                  <p>{n.message}</p>
                  <p className="text-xs mt-2">
                    {formatDistanceToNow(new Date(n.createdAt), {
                      addSuffix: true,
                    })}
                  </p>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
