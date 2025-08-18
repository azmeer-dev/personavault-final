import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { authenticateApp } from "@/lib/app-auth";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");

  // ───── API key (Bearer) auth ─────
  if (authHeader?.startsWith("Bearer ")) {
    const authResult = await authenticateApp(req);

    if (authResult.error) {
      return authResult.error;
    }

    if (authResult.app) {
      try {
        const logs = await prisma.auditLog.findMany({
          where: {
            actorAppId: authResult.app.id,
          },
          orderBy: {
            timestamp: "desc",
          },
          take: 100,
        });

        return new NextResponse(
          JSON.stringify({ logs }, null, 2), // ← 2 spaces indentation
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      } catch (error) {
        console.error("Failed to fetch audit logs:", error);
        return NextResponse.json(
          { error: "Failed to fetch audit logs" },
          { status: 500 }
        );
      }
    }
  }

  // ───── Session-based user auth ─────
  const token = await getToken({ req });

  if (!token?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = token.sub;

  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        actorUserId: userId,
      },
      orderBy: {
        timestamp: "desc",
      },
      take: 100,
    });

    return new NextResponse(
      JSON.stringify({ logs }, null, 2), // ← 2 spaces indentation
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Failed to fetch audit logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}
