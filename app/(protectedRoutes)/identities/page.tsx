/* app/identities/page.tsx */
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import prisma from '@/lib/prisma';

import IdentityLiveCard, {
  type IdentityLiveCardProps,
} from '@/components/identity/IdentityLiveCard';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

/* ------------------------------------------------------------------ */
/*  Server-action: delete                                             */
/* ------------------------------------------------------------------ */
async function deleteIdentity(formData: FormData): Promise<void> {
  'use server';
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/signin');
  const id = formData.get('id')?.toString();
  if (!id) return;
  await prisma.identity.delete({ where: { id } });
  revalidatePath('/identities');
}

/* ------------------------------------------------------------------ */
/*  Helper: runtime-safe JSON parse                                   */
/* ------------------------------------------------------------------ */
function safeJson<T>(value: unknown, fallback: T): T {
  return (value && typeof value === 'object') ? (value as T) : fallback;
}

/* ------------------------------------------------------------------ */
/*  Page component                                                    */
/* ------------------------------------------------------------------ */
export default async function IdentitiesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/signin');
  const userId = session.user.id;

  /* accounts => to resolve provider labels in the chips */
  const accounts = await prisma.account.findMany({
    where: { userId },
    select: { id: true, provider: true, emailFromProvider: true },
  });

  /* all identities */
  const identities = await prisma.identity.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: { linkedExternalAccounts: { select: { accountId: true } } },
  });

  /* convert DB rows → card props */
  const cards: IdentityLiveCardProps[] = identities.map((row) => {
    const data: IdentityLiveCardProps['data'] = {
      identityLabel: row.identityLabel,
      profilePictureUrl: row.profilePictureUrl ?? undefined,
      description: row.description ?? undefined,
      category: row.category,
      customCategoryName: row.customCategoryName ?? undefined,
      contextualNameDetails: safeJson(row.contextualNameDetails, {
        preferredName: '',
        usageContext: '',
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

  /* ---------------- render ---------------- */
  return (
    <main className="space-y-8 p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-semibold">Identities</h1>

      <Button asChild>
        <Link href="/identities/create">Create New Identity</Link>
      </Button>

      {cards.length === 0 && (
        <p className="text-muted-foreground">
          You do not have any identities.
        </p>
      )}

      <div className="space-y-6">
        {cards.map((card, i) => (
          <div
            key={identities[i].id}
            className="relative rounded-2xl shadow-sm"
          >
            {/* actions */}
            <div className="absolute top-4 right-4 flex gap-2">
              <Link href={`/identities/${identities[i].id}`}>
                <Button size="sm" variant="outline">
                  Edit
                </Button>
              </Link>
              <form action={deleteIdentity}>
                <input
                  type="hidden"
                  name="id"
                  value={identities[i].id}
                />
                <Button size="sm" variant="destructive">
                  Delete
                </Button>
              </form>
            </div>

            {/* name-card */}
            <IdentityLiveCard {...card} />
          </div>
        ))}
      </div>
    </main>
  );
}
