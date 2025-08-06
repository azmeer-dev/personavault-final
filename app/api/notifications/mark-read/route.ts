import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await req.json();

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Invalid notification ID" }, { status: 400 });
  }

  try {
    const notification = await prisma.notification.updateMany({
      where: {
        id,
        recipientId: session.user.id,
      },
      data: {
        read: true,
      },
    });

    if (notification.count === 0) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to mark notification as read:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
