// app/api/test-notification/route.ts
import { NextResponse } from "next/server";
import { sendNotification } from "@/lib/notifications";

export async function GET() {
  await sendNotification({
    recipientId: "cmb21e3c3000acqkw8rjh6l8y", // replace with a real user ID
    title: "Test Notification",
    message: "This is a test message.",
    link: "/dashboard",
    type: "test",
  });

  return NextResponse.json({ success: true });
}
