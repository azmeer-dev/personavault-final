// app/api/identities/[id]/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { Prisma } from "@prisma/client";
import { IdentitySchema } from "@/schemas/identity";

export async function PUT(
  request: Request,
  context: { params: { id: string } }
) {
  const { id } = await context.params;

  // 1. Authenticate
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // 2. Parse & validate payload
  const body = await request.json();
  const parsed = IdentitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { errors: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const {
    name,
    category,
    customCategory,
    description,
    previousNames,
    religiousNames,
    visibility,
    connectedAccountIds,
    adHocAccounts,
  } = parsed.data;

  // 3. Ensure the identity belongs to this user
  const existing = await prisma.identity.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 4. Build customFields JSON
  const customFields: Prisma.JsonObject = {};
  if (previousNames) {
    customFields.previousNames = previousNames
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (religiousNames) {
    customFields.religiousNames = religiousNames
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (adHocAccounts.length) {
    customFields.adHocAccounts = adHocAccounts;
  }

  // 5. Update by id
  try {
    await prisma.identity.update({
      where: { id },
      data: {
        name,
        category: category === "Custom" ? customCategory! : category,
        customValue: category === "Custom" ? customCategory! : undefined,
        description,
        visibility,
        customFields:
          Object.keys(customFields).length > 0 ? customFields : undefined,
        accounts: {
          set: connectedAccountIds.map((id) => ({ id })),
        },
      },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
