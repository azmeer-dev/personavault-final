"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function TestNotificationPage() {
  const triggerNotification = async () => {
    const res = await fetch("/api/test-notification");

    if (res.ok) {
      toast.success("Notification sent!");
    } else {
      toast.error("Failed to send notification.");
    }
  };

  return (
    <main className="p-10">
      <h1 className="text-2xl font-bold mb-4">Test Notification</h1>
      <Button onClick={triggerNotification}>Trigger Test Notification</Button>
    </main>
  );
}
