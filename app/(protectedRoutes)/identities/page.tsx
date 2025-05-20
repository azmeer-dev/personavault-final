import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/prisma";

import IdentityLiveCard, {
  type IdentityLiveCardProps,
} from "@/components/identity/IdentityLiveCard";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import DeleteIdentityButton from "@/components/identity/DeleteIdentityButton";

function safeJson<T>(value: unknown, fallback: T): T {
  return value && typeof value === "object" ? (value as T) : fallback;
}

export default async function IdentitiesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");
  const userId = session.user.id;

  const accounts = await prisma.account.findMany({
    where: { userId },
    select: { id: true, provider: true, emailFromProvider: true },
  });

  const identities = await prisma.identity.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: { linkedExternalAccounts: { select: { accountId: true } } },
  });

  const cards: IdentityLiveCardProps[] = identities.map((row) => {
    const data: IdentityLiveCardProps["data"] = {
      identityLabel: row.identityLabel,
      profilePictureUrl: row.profilePictureUrl ?? undefined,
      description: row.description ?? undefined,
      category: row.category,
      customCategoryName: row.customCategoryName ?? undefined,
      contextualNameDetails: safeJson(row.contextualNameDetails, {
        preferredName: "",
        usageContext: "",
      }),
      pronouns: row.pronouns ?? undefined,
      genderIdentity: row.genderIdentity ?? undefined,
      location: row.location ?? undefined,
      dateOfBirth: row.dateOfBirth
        ? row.dateOfBirth.toISOString().slice(0, 10)
        : undefined,
      websiteUrls: row.websiteUrls ?? [],
      linkedAccountIds: row.linkedExternalAccounts.map((l) => l.accountId),
    };

    return { data, accounts };
  });

  return (
    <main className="space-y-8 p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-semibold">Identities</h1>

      <Button asChild>
        <Link href="/identities/create">Create New Identity</Link>
      </Button>

      {cards.length === 0 && (
        <p className="text-muted-foreground">You do not have any identities.</p>
      )}

      <div className="space-y-6">
        {cards.map((card, i) => (
          <div
            key={identities[i].id}
            className="rounded-2xl shadow-sm border p-4 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:justify-end sm:gap-2">
              <Link href={`/identities/${identities[i].id}`}>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full sm:w-auto mb-2 sm:mb-0"
                >
                  Edit
                </Button>
              </Link>
              <DeleteIdentityButton id={identities[i].id} />
            </div>

            <IdentityLiveCard {...card} classProp="border-0" />
          </div>
        ))}
      </div>
    </main>
  );
}
