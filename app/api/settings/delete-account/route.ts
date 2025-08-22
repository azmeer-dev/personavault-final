import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

const SECRET = process.env.NEXTAUTH_SECRET;

export async function DELETE(req: NextRequest) {
  const token = await getToken({ req, secret: SECRET });

  if (!token?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { password } = await req.json();

  const user = await prisma.user.findUnique({
    where: { id: token.sub },
  });

  if (!user?.passwordHash) {
    return NextResponse.json({ error: "Password not set on this account" }, { status: 400 });
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 403 });
  }

  try {
    await prisma.user.delete({
      where: { id: user.id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete user:", err);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
