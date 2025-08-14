/* app/(protectedRoutes)/identities/page.tsx */
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
import DeleteIdentityButton from "@/components/identity/DeleteIdentityButton";
import { Button } from "@/components/ui/button";
import Link from "next/link";

import type { PublicIdentity, PrivateIdentityStub } from "@/types/identity";

/* ---------- helper ---------- */
function toCardIdentity(
  row: Awaited<ReturnType<typeof prisma.identity.findMany>>[0] & {
    linkedExternalAccounts: { accountId: string }[];
  },
  currentUserId: string
): (PublicIdentity | PrivateIdentityStub) & {
  userId: string;
  isOwner: boolean;
} {
  const isOwner = row.userId === currentUserId;

  if (row.visibility === IdentityVisibility.PRIVATE && !isOwner) {
    return {
      id: row.id,
      visibility: row.visibility,
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
    websiteUrls: row.websiteUrls ?? [],
    linkedAccountIds: row.linkedExternalAccounts.map((l) => l.accountId),
    userId: row.userId,
    isOwner,
  };
}

export default async function IdentitiesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");
  const currentUserId = session.user.id;

  /* ---------- supporting data ---------- */
  const accounts = await prisma.account.findMany({
    where: { userId: currentUserId },
    select: { id: true, provider: true, emailFromProvider: true },
  });

  /* ---------- identities ---------- */
  const identitiesRaw = await prisma.identity.findMany({
    where: { userId: currentUserId },
    orderBy: { updatedAt: "desc" }, // no userId filter → list can include others
    include: {
      linkedExternalAccounts: { select: { accountId: true } },
    },
  });

  const identities = identitiesRaw.map((row) =>
    toCardIdentity(row, currentUserId)
  );

  /* ---------- pending consent requests ---------- */
  const pendingRequests = await prisma.consentRequest.findMany({
    where: { requestingUserId: currentUserId },
    orderBy: { createdAt: "desc" },
    select: { identityId: true, status: true },
  });

  // keep only the latest request per identity (skip null identityIds)
  const latestRequests = pendingRequests.reduce<
    Record<string, ConsentRequestStatus>
  >((acc, r) => {
    if (r.identityId && !(r.identityId in acc)) {
      acc[r.identityId] = r.status;
    }
    return acc;
  }, {});

  // collect identity IDs whose latest request is still pending
  const pendingIds = new Set(
    Object.entries(latestRequests)
      .filter(([, status]) => status === ConsentRequestStatus.PENDING)
      .map(([id]) => id)
  );

  /* ---------- UI ---------- */
  return (
    <main className="space-y-8 p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-semibold">Identities</h1>

      <Button asChild>
        <Link href="/identities/create">Create New Identity</Link>
      </Button>

      {identities.length === 0 && (
        <p className="text-muted-foreground">You do not have any identities.</p>
      )}

      <div className="space-y-6">
        {identities.map((identity) => (
          <RequestableIdentityCard
            key={identity.id}
            identity={identity}
            accounts={accounts}
            isCurrentUserOwner={identity.isOwner}
            hasPendingRequest={pendingIds.has(identity.id)}
          >
            {identity.isOwner && (
              <div className="flex flex-col sm:flex-row sm:justify-end sm:gap-2 mt-2">
                <Link href={`/identities/${identity.id}`}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full sm:w-auto mb-2 sm:mb-0"
                  >
                    Edit
                  </Button>
                </Link>
                <DeleteIdentityButton id={identity.id} />
              </div>
            )}
          </RequestableIdentityCard>
        ))}
      </div>
    </main>
  );
}
