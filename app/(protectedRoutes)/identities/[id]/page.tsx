// app/(protectedRoutes)/identities/[id]/page.tsx
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

import IdentityEditor from '@/components/identity/IdentityEditor';
import type { IdentityFormValues } from '@/types/types';

/* ------------------------------------------------------------------ */
/*  Utility parsers (unchanged)                                       */
/* ------------------------------------------------------------------ */

type ContextualNameDetailsRaw = { preferredName: unknown; usageContext: unknown };

function parseContextualNameDetails(
  val: unknown,
): { preferredName: string; usageContext: string } {
  if (
    val &&
    typeof val === 'object' &&
    !Array.isArray(val) &&
    'preferredName' in val &&
    'usageContext' in val
  ) {
    const obj = val as ContextualNameDetailsRaw;
    return {
      preferredName:
        typeof obj.preferredName === 'string'
          ? obj.preferredName
          : String(obj.preferredName),
      usageContext:
        typeof obj.usageContext === 'string'
          ? obj.usageContext
          : String(obj.usageContext),
    };
  }
  return { preferredName: '', usageContext: '' };
}

type HistoryEntryRaw = { name: unknown; from: unknown; to: unknown; context: unknown };

function parseIdentityNameHistory(
  val: unknown,
): { name: string; from: string; to: string; context: string }[] {
  if (!Array.isArray(val)) return [];
  return val
    .filter(
      (item): item is HistoryEntryRaw =>
        item &&
        typeof item === 'object' &&
        'name' in item &&
        'from' in item &&
        'to' in item &&
        'context' in item,
    )
    .map((item) => ({
      name: typeof item.name === 'string' ? item.name : String(item.name),
      from: typeof item.from === 'string' ? item.from : String(item.from),
      to: typeof item.to === 'string' ? item.to : String(item.to),
      context: typeof item.context === 'string' ? item.context : String(item.context),
    }));
}

function parseRecord(val: unknown): Record<string, string> {
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(val)) if (typeof v === 'string') out[k] = v;
    return out;
  }
  return {};
}

function parseVisibility(val: unknown): 'PRIVATE' | 'PUBLIC' {
  return val === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE';
}

/* ------------------------------------------------------------------ */
/*  Page component                                                    */
/* ------------------------------------------------------------------ */

interface PageProps {
  params: { id: string };
}

export default async function EditIdentityPage({ params }: PageProps) {
  /* -------- Auth -------- */
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/signin');
  const userId = session.user.id;

  /* -------- Data fetch -------- */
  const identity = await prisma.identity.findFirst({
    where: { id: params.id, userId },
    include: { linkedExternalAccounts: { select: { accountId: true } } },
  });
  if (!identity) redirect('/identities');

  const rawAccounts = await prisma.account.findMany({
    where: { userId },
    select: { id: true, provider: true, emailFromProvider: true },
    orderBy: { provider: 'asc' },
  });

  const accountOptions = rawAccounts.map((a) => ({
    id: a.id,
    provider: a.provider,
    emailFromProvider: a.emailFromProvider,
  }));

  /* -------- Parse flexible columns -------- */
  const initialValues: Partial<IdentityFormValues> = {
    identityLabel: identity.identityLabel,
    category: identity.category,
    customCategoryName: identity.customCategoryName ?? '',
    description: identity.description ?? '',
    contextualNameDetails: parseContextualNameDetails(identity.contextualNameDetails),
    identityNameHistory: parseIdentityNameHistory(identity.identityNameHistory),
    contextualReligiousNames: identity.contextualReligiousNames ?? [],
    genderIdentity: identity.genderIdentity ?? '',
    customGenderDescription: identity.customGenderDescription ?? '',
    pronouns: identity.pronouns ?? '',
    dateOfBirth: identity.dateOfBirth
      ? identity.dateOfBirth.toISOString().slice(0, 10)
      : '',
    location: identity.location ?? '',
    profilePictureUrl: identity.profilePictureUrl ?? '',
    identityContacts: parseRecord(identity.identityContacts),
    onlinePresence: parseRecord(identity.onlinePresence),
    websiteUrls: identity.websiteUrls ?? [],
    additionalAttributes: parseRecord(identity.additionalAttributes),
    visibility: parseVisibility(identity.visibility),
    linkedAccountIds: identity.linkedExternalAccounts.map((la) => la.accountId),
  };

  /* -------- Render -------- */
  return (
    <main className="p-6 max-w-6xl mx-auto overflow-hidden">
      <h1 className="text-2xl font-semibold mb-6">Edit Identity</h1>

      <IdentityEditor
        userId={userId}
        accounts={accountOptions}
        initialValues={initialValues}
        identityId={params.id}
      />
    </main>
  );
}
