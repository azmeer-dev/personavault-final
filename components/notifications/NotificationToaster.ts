"use client";

import { useNotificationListener } from "@/hooks/useNotificationListener";

export default function NotificationToaster() {
  useNotificationListener();
  return null;
}
