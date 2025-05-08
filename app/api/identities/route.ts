// app/api/identities/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const PayloadSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  customCategory: z.string().optional(),
  description: z.string().optional(),
  previousNames: z.string().optional(),
  religiousNames: z.string().optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
  connectedAccountIds: z.array(z.string()).optional(),
  adHocAccounts: z
    .array(
      z.object({
        provider: z.string().min(1),
        info: z.string().min(1),
      })
    )
    .optional(),
}).refine(
  (d) => d.category !== "Custom" || !!d.customCategory,
  {
    message: "Custom category is required",
    path: ["customCategory"],
  }
);

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = PayloadSchema.safeParse(body);
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
    connectedAccountIds = [],
    adHocAccounts = [],
  } = parsed.data;

  // Build customFields JSON
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

  try {
    await prisma.identity.create({
      data: {
        name,
        category: category === "Custom" ? customCategory! : category,
        description,
        visibility,
        customValue:
          category === "Custom" ? customCategory! : undefined,
        customFields:
          Object.keys(customFields).length > 0 ? customFields : undefined,
        user: { connect: { id: session.user.id } },
        accounts:
          connectedAccountIds.length > 0
            ? { connect: connectedAccountIds.map((id) => ({ id })) }
            : undefined,
      },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
