// app/(protectedRoutes)/explore/page.tsx

import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/prisma";

import {
  IdentityVisibility,
  IdentityCategoryType,
  ConsentRequestStatus,
} from "@prisma/client";

import RequestableIdentityCard from "@/components/identity/RequestableIdentityCard";
import Link from "next/link";

import type { PublicIdentity, PrivateIdentityStub } from "@/types/identity";

/* ---------- helper ---------- */
function toCardIdentity(
  row: Awaited<ReturnType<typeof prisma.identity.findMany>>[0] & {
    linkedExternalAccounts: { accountId: string }[];
  },
  currentUserId: string,
  hasAccess: boolean
): (PublicIdentity | PrivateIdentityStub) & {
  userId: string;
  isOwner: boolean;
} {
  const isOwner = row.userId === currentUserId;

  if (!hasAccess && !isOwner) {
    return {
      id: row.id,
      visibility: (["PRIVATE", "APP_SPECIFIC"].includes(row.visibility)
        ? row.visibility
        : "PRIVATE") as "PRIVATE" | "APP_SPECIFIC",
      category: row.category,
      customCategoryName:
        row.category === IdentityCategoryType.CUSTOM
          ? row.customCategoryName
          : null,
      identityLabel: "Private Identity",
      profilePictureUrl: "/img/private-icon.svg",
      userId: row.userId,
      isOwner,
    };
  }

  const cnd =
    row.contextualNameDetails && typeof row.contextualNameDetails === "object"
      ? (row.contextualNameDetails as {
          preferredName?: string;
          usageContext?: string;
        })
      : {};

  return {
    id: row.id,
    identityLabel: row.identityLabel,
    profilePictureUrl: row.profilePictureUrl ?? null,
    description: row.description ?? null,
    category: row.category,
    customCategoryName: row.customCategoryName ?? null,
    genderIdentity: row.genderIdentity ?? null,
    pronouns: row.pronouns ?? null,
    location: row.location ?? null,
    dateOfBirth: row.dateOfBirth ?? null,
    visibility: row.visibility,
    contextualNameDetails: {
      preferredName: cnd.preferredName ?? "",
      usageContext: cnd.usageContext ?? "",
    },
    websiteUrls: Array.isArray(row.websiteUrls) ? row.websiteUrls : [],
    linkedAccountIds: row.linkedExternalAccounts.map((l) => l.accountId),
    userId: row.userId,
    isOwner,
  };
}

export default async function ExplorePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");
  const currentUserId = session.user.id;

  const accounts = await prisma.account.findMany({
    where: { userId: currentUserId },
    select: { id: true, provider: true, emailFromProvider: true },
  });

  const [identitiesRaw, pendingRequests, identityConsents, userConsents] =
    await Promise.all([
      prisma.identity.findMany({
        where: { userId: { not: currentUserId } },
        orderBy: { updatedAt: "desc" },
        include: {
          linkedExternalAccounts: { select: { accountId: true } },
        },
      }),
      prisma.consentRequest.findMany({
        where: {
          requestingUserId: currentUserId,
          status: ConsentRequestStatus.PENDING,
        },
        select: { identityId: true },
      }),
      prisma.consent.findMany({
        where: {
          requestingUserId: currentUserId,
          identityId: { not: null },
          revokedAt: null,
        },
        select: { identityId: true },
      }),
      prisma.consent.findMany({
        where: {
          requestingUserId: currentUserId,
          identityId: null,
          revokedAt: null,
        },
        select: { userId: true },
      }),
    ]);

  const pendingIds = new Set(pendingRequests.map((r) => r.identityId));
  const consentedIdentityIds = new Set(identityConsents.map((c) => c.identityId!));
  const consentedUserIds = new Set(userConsents.map((c) => c.userId));

  const identities = identitiesRaw.map((row) => {
    const hasAccess =
      row.visibility === IdentityVisibility.PUBLIC ||
      row.visibility === IdentityVisibility.AUTHENTICATED_USERS ||
      consentedIdentityIds.has(row.id) ||
      consentedUserIds.has(row.userId);

    const shaped = toCardIdentity(row, currentUserId, hasAccess);
    return { ...shaped, _hasAccess: hasAccess };
  });

  return (
    <main className="space-y-8 p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-semibold">Explore Identities</h1>

      {identities.length === 0 ? (
        <p className="text-muted-foreground">
          No identities to explore right now.
        </p>
      ) : (
        <div className="space-y-6">
          {identities.map((identity) => {
            const card = (
              <RequestableIdentityCard
                key={identity.id}
                identity={identity}
                accounts={accounts}
                isCurrentUserOwner={identity.isOwner}
                hasPendingRequest={pendingIds.has(identity.id)}
              />
            );

            return identity._hasAccess ? (
              <Link
                href={`/explore/${identity.id}`}
                key={identity.id}
                className="block"
              >
                {card}
              </Link>
            ) : (
              <div key={identity.id}>{card}</div>
            );
          })}
        </div>
      )}
    </main>
  );
}
