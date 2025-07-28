import { prisma } from "@/lib/prisma";

interface NotificationData {
  [key: string]: any;
}

export async function sendNotification(
  userId: string,
  type: string,
  data: NotificationData
) {
  try {
    await prisma.notification.create({
      data: {
        userId,
        type,
        data,
      },
    });
  } catch (error) {
    console.error("Failed to send notification:", error);
  }
}
