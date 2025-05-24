// app/api/explore/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/prisma";
import { type IdentityLiveCardProps } from "@/components/identity/IdentityLiveCard"; // Import the type

// fallback for contextualNameDetails (moved from page.tsx)
const defaultContextual = { preferredName: "", usageContext: "" };

// type guard for contextualNameDetails (moved from page.tsx)
function isContextual(
  val: unknown
): val is { preferredName: string; usageContext: string } {
  return (
    typeof val === "object" &&
    val !== null &&
    "preferredName" in val &&
    "usageContext" in val &&
    typeof val.preferredName === "string" && // Added type assertion for safety
    typeof val.usageContext === "string" // Added type assertion for safety
  );
}

export async function GET() {

   const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  console.log(userId)

  try {

    // fetch all other users' public identities
    const identities = await prisma.identity.findMany({
      where: {
        visibility: "PUBLIC",
        ...(userId && { userId: { not: userId } }), // Exclude own identities if logged in
      },
      orderBy: { updatedAt: "desc" },
      select: { // Explicitly select fields to avoid fetching userId
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
        visibility: true, // Still needed for the where clause, though not directly mapped
        updatedAt: true, // Still needed for orderBy, though not directly mapped
        // userId is now EXCLUDED from fetching
        linkedExternalAccounts: {
          select: {
            accountId: true,
            account: { select: { provider: true } },
          },
        },
      },
    });

    // map each row into the props your LiveCard expects
    const cards: IdentityLiveCardProps[] = identities.map((row) => {
      // narrow or fallback contextualNameDetails
      const contextualDetails = isContextual(row.contextualNameDetails)
        ? row.contextualNameDetails
        : defaultContextual;

      const data: IdentityLiveCardProps["data"] = {
        identityLabel: row.identityLabel,
        identityId: row.id,
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
        linkedAccountIds: row.linkedExternalAccounts.map(
          (l: { accountId: string }) => l.accountId
        ),
      };

      const accounts: IdentityLiveCardProps["accounts"] =
        row.linkedExternalAccounts.map(
          (l: { accountId: string; account: { provider: string } }) => ({
            id: l.accountId,
            provider: l.account.provider,
            emailFromProvider: null, // This field is not selected, so it's null
          })
        );

      return { data, accounts };
    });

    return NextResponse.json(cards);
  } catch (error) {
    console.error("Failed to fetch public identities:", error);
    return NextResponse.json(
      { error: "Failed to fetch public identities" },
      { status: 500 }
    );
  }
}
