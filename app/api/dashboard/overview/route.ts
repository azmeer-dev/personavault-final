// app/api/dashboard/overview/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/options";
import prisma from "@/lib/prisma";

export async function GET() {
  //checks authentication (double safeguard)
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  console.log(userId)

  try {
    //fetch all counts in parallel
    const [accounts, identities, apps, pendingConsents, auditLogs] =
      await Promise.all([
        prisma.account.count({ where: { userId } }),
        prisma.identity.count({ where: { userId } }),
        prisma.app.count({ where: { ownerId: userId } }),
        prisma.consentRequest.count({
          where: { targetUserId: userId, status: "PENDING" },
        }),
        prisma.auditLog.count({
          where: {
            targetEntityId: userId,
          },
        }),
      ]);

    //returns the overview data
    return NextResponse.json({
      accounts,
      identities,
      apps,
      pendingConsents,
      auditLogs,
    });
  } catch (err) {
    console.error("Overview error:", err);
    return NextResponse.json(
      { error: "Failed to load overview" },
      { status: 500 }
    );
  }
}
