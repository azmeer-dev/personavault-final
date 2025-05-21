// app/api/explore/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/prisma";

// get public identities excluding the current user
export async function GET() {
  const session = await getServerSession(authOptions);
  const me = session?.user?.id;

  try {
    const identities = await prisma.identity.findMany({
      where: {
        visibility: "PUBLIC",
        ...(me && { userId: { not: me } }),
      },
      include: {
        linkedExternalAccounts: {
          select: {
            accountId: true,             // include id for linking
            account: { select: { provider: true } }, // include provider name
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const payload = identities.map((i) => ({
      id: i.id,
      identityLabel: i.identityLabel,
      category: i.category,
      customCategoryName: i.customCategoryName ?? null,
      description: i.description ?? null,
      genderIdentity: i.genderIdentity ?? null,
      pronouns: i.pronouns ?? null,
      location: i.location ?? null,
      dateOfBirth: i.dateOfBirth
        ? i.dateOfBirth.toISOString().slice(0, 10)
        : null,
      profilePictureUrl: i.profilePictureUrl ?? null,
      websiteUrls: i.websiteUrls,
      contextualNameDetails: i.contextualNameDetails,
      linkedAccountIds: i.linkedExternalAccounts.map((l) => l.accountId),
      providers: i.linkedExternalAccounts.map((l) => l.account.provider),
    }));

    return NextResponse.json(payload);
  } catch (err) {
    console.error("failed to load public identities", err);
    return NextResponse.json(
      { error: "internal server error" },
      { status: 500 }
    );
  }
}
