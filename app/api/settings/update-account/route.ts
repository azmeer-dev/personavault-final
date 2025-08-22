import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";


const SECRET = process.env.NEXTAUTH_SECRET;

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: SECRET });
  if (!token?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = token.sub;
  const body = await req.json();
  const { globalDisplayName, globalProfileImage } = body as {
    globalDisplayName?: string;
    globalProfileImage?: string;
  };

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(globalDisplayName !== undefined
          ? { globalDisplayName }
          : {}),
        ...(globalProfileImage !== undefined
          ? { globalProfileImage }
          : {}),
      },
      select: {
        id: true,
        globalDisplayName: true,
        globalProfileImage: true,
      },
    });

    return NextResponse.json({ user: updated });
  } catch (err) {
    console.error("Update account failed:", err);
    return NextResponse.json(
      { error: "Failed to update account" },
      { status: 500 }
    );
  }
}
