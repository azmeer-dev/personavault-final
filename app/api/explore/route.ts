// app/api/explore/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/prisma";
import { type IdentityLiveCardProps } from "@/components/identity/IdentityLiveCard";

// fallback for contextualNameDetails
const defaultContextual = { preferredName: "", usageContext: "" };

// type guard
function isContextual(val: unknown): val is { preferredName: string; usageContext: string } {
  return (
    typeof val === "object" &&
    val !== null &&
    "preferredName" in val &&
    "usageContext" in val &&
    typeof (val).preferredName === "string" &&
    typeof (val).usageContext === "string"
  );
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const identities = await prisma.identity.findMany({
      where: {
        userId: { not: userId },
        OR: [
          { visibility: "PUBLIC" },
          {
            relatedConsents: {
              some: {
                requestingUserId: userId,
                revokedAt: null,
                grantedScopes: { has: "identity.read" },
              },
            },
          },
          {
            user: {
              consentsGiven: {
                some: {
                  requestingUserId: userId,
                  identityId: null,
                  revokedAt: null,
                  grantedScopes: { has: "identity.read" },
                },
              },
            },
          },
        ],
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        identityLabel: true,
        profilePictureUrl: true,
        description: true,
        category: true,
        customCategoryName: true,
        contextualNameDetails: true,
        pronouns: true,
        genderIdentity: true,
        location: true,
        dateOfBirth: true,
        websiteUrls: true,
        visibility: true,
        updatedAt: true,
        linkedExternalAccounts: {
          select: {
            accountId: true,
            account: { select: { provider: true } },
          },
        },
      },
    });

    const cards: IdentityLiveCardProps[] = identities.map((row) => {
      const contextualDetails = isContextual(row.contextualNameDetails)
        ? row.contextualNameDetails
        : defaultContextual;

      const data: IdentityLiveCardProps["data"] = {
        identityId: row.id,
        identityLabel: row.identityLabel,
        profilePictureUrl: row.profilePictureUrl ?? null,
        description: row.description ?? null,
        category: row.category,
        customCategoryName: row.customCategoryName ?? null,
        contextualNameDetails: contextualDetails,
        pronouns: row.pronouns ?? null,
        genderIdentity: row.genderIdentity ?? null,
        location: row.location ?? null,
        dateOfBirth: row.dateOfBirth ?? null,
        websiteUrls: row.websiteUrls ?? [],
        linkedAccountIds: row.linkedExternalAccounts.map((l) => l.accountId),
      };

      const accounts: IdentityLiveCardProps["accounts"] = row.linkedExternalAccounts.map((l) => ({
        id: l.accountId,
        provider: l.account.provider,
        emailFromProvider: null,
      }));

      return { data, accounts };
    });

    return NextResponse.json(cards);
  } catch (error) {
    console.error("Failed to fetch identities:", error);
    return NextResponse.json({ error: "Failed to fetch identities" }, { status: 500 });
  }
}
