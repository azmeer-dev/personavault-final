// page.tsx
import { getIdentityById, logAuditEntry } from "@/lib/identity";
import FullIdentityProfile from "@/components/identity/FullIdentityView";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { notFound } from "next/navigation";
import { AuditActorType, AuditLogOutcome } from "@prisma/client";
//export const dynamic = "force-dynamic";

export default async function IdentityPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const identity = await getIdentityById(resolvedParams.id);
  if (!identity) return notFound();

  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id ?? "anonymous";
  const viewerType = session ? AuditActorType.USER : AuditActorType.SYSTEM;

  await logAuditEntry({
    actorType: viewerType,
    actorUserId: viewerType === AuditActorType.USER ? viewerId : undefined,
    actorAppId: undefined, // no APP actor here
    action: "VIEW_PUBLIC_IDENTITY",
    targetEntityType: "Identity",
    targetEntityId: identity.id,
    outcome: AuditLogOutcome.SUCCESS,
    details: { source: "page" },
  });

  const raw = identity.contextualNameDetails;
  const contextual =
    typeof raw === "object" &&
    raw !== null &&
    "preferredName" in raw &&
    "usageContext" in raw
      ? (raw as unknown as { preferredName: string; usageContext: string })
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
          websiteUrls: identity.websiteUrls,
          contextualNameDetails: contextual,
          linkedAccountEmails: identity.linkedExternalAccounts.map(
            (a) => a.accountId
          ),
        }}
      />
    </div>
  );
}
