import { prisma } from "@/lib/prisma";
import { sendEmail as sendEmailFunction } from "@/lib/email"; // ✅ Rename the import

type BaseNotifyOptions = {
  recipientId: string;
  title: string;
  message: string;
  link?: string;
  type: string;
  sendEmail?: boolean;
};

export async function sendNotification({
  recipientId,
  title,
  message,
  link,
  type,
  sendEmail = true, // ✅ This is now a boolean flag, not a function
}: BaseNotifyOptions) {
  const notification = await prisma.notification.create({
    data: {
      recipientId,
      title,
      message,
      link,
      type,
    },
  });

  if (sendEmail) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: recipientId },
      });

      if (user?.email) {
        await sendEmailFunction({
          to: user.email,
          subject: title,
          body: message,
        });
      }
    } catch (error) {
      console.error("Failed to send notification email:", error);
    }
  }

  return notification;
}
