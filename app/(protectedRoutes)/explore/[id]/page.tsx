// app/(protectedRoutes)/explore/[id]/page.tsx

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { notFound } from "next/navigation";

import { getIdentityById } from "@/lib/identity";
import { createAuditLog } from "@/lib/audit";
import { AuditActorType, AuditLogOutcome } from "@prisma/client";

import FullIdentityProfile from "@/components/identity/FullIdentityView";

export default async function IdentityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id ?? null;
  const viewerType = viewerId ? AuditActorType.USER : AuditActorType.SYSTEM;

  const identity = await getIdentityById(id, viewerId);

  if (!identity) return notFound();

  await createAuditLog({
    actorType: viewerType,
    actorUserId: viewerId ?? undefined,
    actorAppId: undefined,
    action: "VIEW_PUBLIC_IDENTITY",
    targetEntityType: "Identity",
    targetEntityId: identity.id,
    outcome: AuditLogOutcome.SUCCESS,
    details: { source: "explore/[id]" },
  });

  const contextual =
    typeof identity.contextualNameDetails === "object" &&
    identity.contextualNameDetails !== null &&
    "preferredName" in identity.contextualNameDetails &&
    "usageContext" in identity.contextualNameDetails
      ? (identity.contextualNameDetails as {
          preferredName: string;
          usageContext: string;
        })
      : { preferredName: "", usageContext: "" };

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6">Identity Profile</h1>
      <FullIdentityProfile
        data={{
          identityLabel: identity.identityLabel,
          category: identity.category,
          customCategoryName: identity.customCategoryName,
          description: identity.description,
          genderIdentity: identity.genderIdentity,
          pronouns: identity.pronouns,
          location: identity.location,
          dateOfBirth: identity.dateOfBirth,
          profilePictureUrl: identity.profilePictureUrl,
          websiteUrls: identity.websiteUrls ?? [],
          contextualNameDetails: contextual,
          linkedAccountEmails: identity.linkedExternalAccounts
            .map((a) => a.account.emailFromProvider)
            .filter((email): email is string => !!email),
          provider: identity.linkedExternalAccounts
            .map((a) => a.account.provider)
            .filter((provider): provider is string => !!provider),
        }}
      />
    </div>
  );
}
