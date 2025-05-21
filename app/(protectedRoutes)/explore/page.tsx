// app/(protectedRoutes)/explore/page.tsx
import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/prisma";
import IdentityLiveCard, {
  type IdentityLiveCardProps,
} from "@/components/identity/IdentityLiveCard";

// fallback for contextualNameDetails
const defaultContextual = { preferredName: "", usageContext: "" };

// type guard for contextualNameDetails
function isContextual(
  val: unknown
): val is { preferredName: string; usageContext: string } {
  return (
    typeof val === "object" &&
    val !== null &&
    "preferredName" in val &&
    "usageContext" in val &&
    typeof (val).preferredName === "string" &&
    typeof (val).usageContext === "string"
  );
}

export default async function ExplorePage() {
  // get current user so we can exclude their own identities
  const session = await getServerSession(authOptions);
  const me = session?.user?.id;

  // fetch all other users' public identities
  const identities = await prisma.identity.findMany({
    where: {
      visibility: "PUBLIC",
      ...(me && { userId: { not: me } }),
    },
    orderBy: { updatedAt: "desc" },
    include: {
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
          emailFromProvider: null,
        })
      );

    return { data, accounts };
  });

  return (
    <main className="space-y-8 p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-semibold">Explore Public Identities</h1>

      {cards.length === 0 ? (
        <p className="text-muted-foreground">
          there are no public identities available.
        </p>
      ) : (
        <div className="space-y-6">
          {cards.map((card, i) => (
            <Link
              href={`/identity/${identities[i].id}`}
              key={identities[i].id}
              className="block" // link to profile view
            >
              <div className="rounded-2xl shadow-sm border p-4 space-y-4">
                <IdentityLiveCard {...card} classProp="border-0" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
