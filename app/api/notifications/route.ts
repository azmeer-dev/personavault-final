import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  const notifications = await prisma.notification.findMany({
    where: {
      recipientId: session.user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
  });

  return NextResponse.json(notifications);
}
